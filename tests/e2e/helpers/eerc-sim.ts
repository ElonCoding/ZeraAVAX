/**
 * Deterministic eERC Adapter Simulator for E2E Tests.
 * Conforms to IEERCAdapter interface contract from PROJECT.md.
 * Implements account registration, confidential payroll transfer preparation,
 * batch execution, homomorphic balance updates, and auditor decryption.
 */

import {
  BabyJub,
  Poseidon,
  Point,
  TransferProof,
  generateMockTransferProof,
} from "./crypto-sim.ts";
import { MockAvalancheRPC, SimulatedLog } from "./mock-rpc.ts";
import { TEST_ACCOUNTS } from "./test-accounts.ts";

export interface IEERCAdapter {
  initialize(rpcUrl: string, tokenAddress: `0x${string}`, registrarAddress?: `0x${string}`): Promise<void>;
  registerAccount(privateKey: `0x${string}`): Promise<{ publicKey: [bigint, bigint]; txHash?: `0x${string}` }>;
  getEncryptedBalance(userAddress: `0x${string}`, viewingKey?: string): Promise<{ encrypted: [bigint, bigint, bigint, bigint]; decrypted?: bigint }>;
  preparePayrollTransfer(params: {
    senderPrivateKey: `0x${string}`;
    recipientAddress: `0x${string}`;
    amount: bigint;
    senderBalance: bigint;
    auditorAddress: `0x${string}`;
  }): Promise<{
    proof: TransferProof;
    balancePCT: string[];
    receiverEncryptedAmount: string[];
    auditorPCT: string[];
  }>;
  executeBatchTransfers(params: {
    batchId: `0x${string}`;
    transfers: Array<{ recipient: `0x${string}`; amount: bigint }>;
    senderPrivateKey: `0x${string}`;
  }): Promise<{ txHashes: `0x${string}`[]; receiptStatuses: number[] }>;
  auditorDecrypt(auditorPrivateKey: string, fromBlock?: bigint): Promise<Array<{
    txHash: `0x${string}`;
    amount: bigint;
    sender: `0x${string}`;
    recipient: `0x${string}`;
    blockNumber: bigint;
  }>>;
}

export class SimulatedEERCAdapter implements IEERCAdapter {
  public tokenAddress: `0x${string}` = "0xcccccccccccccccccccccccccccccccccccccccc";
  public registrarAddress: `0x${string}` = "0xdddddddddddddddddddddddddddddddddddddddd";
  public auditorAddress: `0x${string}` = TEST_ACCOUNTS.auditor.address;
  public auditorPK: Point = TEST_ACCOUNTS.auditor.babyJubPublicKey;

  private registeredKeys: Map<`0x${string}`, Point> = new Map();
  private privateKeys: Map<`0x${string}`, bigint> = new Map();
  private balances: Map<`0x${string}`, bigint> = new Map();
  private initialized: boolean = false;

  constructor(private rpc: MockAvalancheRPC) {
    // Pre-register test personas
    for (const [_, acc] of Object.entries(TEST_ACCOUNTS)) {
      this.registeredKeys.set(acc.address.toLowerCase() as `0x${string}`, acc.babyJubPublicKey);
      this.privateKeys.set(acc.address.toLowerCase() as `0x${string}`, acc.babyJubSecret);
      this.balances.set(acc.address.toLowerCase() as `0x${string}`, 0n);
    }
    // Give employer initial balance (e.g. 100,000,000 units)
    this.balances.set(TEST_ACCOUNTS.employer.address.toLowerCase() as `0x${string}`, 100000000n);
  }

  async initialize(rpcUrl: string, tokenAddress: `0x${string}`, registrarAddress?: `0x${string}`): Promise<void> {
    if (!rpcUrl) throw new Error("eERCAdapter: RPC URL is required");
    this.tokenAddress = tokenAddress;
    if (registrarAddress) this.registrarAddress = registrarAddress;
    this.initialized = true;
  }

  async registerAccount(evmPrivateKey: `0x${string}`): Promise<{ publicKey: [bigint, bigint]; txHash?: `0x${string}` }> {
    // Deterministic secret derivation from EVM private key
    let sk = 10007n;
    for (let i = 2; i < evmPrivateKey.length; i += 2) {
      sk = (sk * 131n + BigInt(`0x${evmPrivateKey.slice(i, i + 2)}`)) % BabyJub.order;
    }
    if (sk === 0n) sk = 1n;
    const pk = BabyJub.generatePublicKey(sk);

    // Derive address
    const mockAddr = `0x${evmPrivateKey.slice(2, 42).padEnd(40, "0")}`.toLowerCase() as `0x${string}`;
    this.registeredKeys.set(mockAddr, pk);
    this.privateKeys.set(mockAddr, sk);

    const receipt = this.rpc.submitTransaction({
      from: mockAddr,
      to: this.registrarAddress,
      data: `0xregister-${pk[0].toString(16).slice(0, 16)}`,
      executionFn: () => ({
        status: 1,
        logs: [
          {
            address: this.registrarAddress,
            topics: ["0xRegister", mockAddr],
            data: `0x${pk[0].toString(16).padStart(64, "0")}${pk[1].toString(16).padStart(64, "0")}`,
            eventName: "Register",
            args: { user: mockAddr, publicKey: pk },
          },
        ],
      }),
    });

    return { publicKey: pk, txHash: receipt.transactionHash };
  }

  async getEncryptedBalance(
    userAddress: `0x${string}`,
    viewingKey?: string
  ): Promise<{ encrypted: [bigint, bigint, bigint, bigint]; decrypted?: bigint }> {
    const addr = userAddress.toLowerCase() as `0x${string}`;
    const bal = this.balances.get(addr) ?? 0n;
    const pk = this.registeredKeys.get(addr) ?? TEST_ACCOUNTS.employer.babyJubPublicKey;

    // Encrypted handle representation (c1.x, c1.y, c2.x, c2.y)
    const eg = BabyJub.mulWithScalar(pk, bal + 100n);
    const encrypted: [bigint, bigint, bigint, bigint] = [
      BabyJub.Base8[0],
      BabyJub.Base8[1],
      eg[0],
      eg[1],
    ];

    let decrypted: bigint | undefined = undefined;
    if (viewingKey) {
      const expectedKey = this.privateKeys.get(addr)?.toString();
      if (viewingKey === expectedKey) {
        decrypted = bal;
      }
    }

    return { encrypted, decrypted };
  }

  async preparePayrollTransfer(params: {
    senderPrivateKey: `0x${string}`;
    recipientAddress: `0x${string}`;
    amount: bigint;
    senderBalance: bigint;
    auditorAddress: `0x${string}`;
  }): Promise<{
    proof: TransferProof;
    balancePCT: string[];
    receiverEncryptedAmount: string[];
    auditorPCT: string[];
  }> {
    if (params.amount <= 0n) {
      throw new Error("preparePayrollTransfer: Amount must be greater than zero");
    }
    if (params.senderBalance < params.amount) {
      throw new Error("preparePayrollTransfer: Insufficient sender balance");
    }

    const recAddr = params.recipientAddress.toLowerCase() as `0x${string}`;
    const recipientPK = this.registeredKeys.get(recAddr);
    if (!recipientPK) {
      throw new Error(`preparePayrollTransfer: Recipient ${params.recipientAddress} is not registered`);
    }

    const senderAddr = TEST_ACCOUNTS.employer.address.toLowerCase() as `0x${string}`;
    const senderPK = this.registeredKeys.get(senderAddr) ?? TEST_ACCOUNTS.employer.babyJubPublicKey;
    const auditorPK = this.auditorPK;

    // Generate Poseidon encryptions
    const receiverEnc = Poseidon.processPoseidonEncryption({
      inputs: [params.amount],
      publicKey: recipientPK,
      nonce: 101n,
    });

    const auditorEnc = Poseidon.processPoseidonEncryption({
      inputs: [params.amount],
      publicKey: auditorPK,
      nonce: 202n,
    });

    const remainingBal = params.senderBalance - params.amount;
    const balanceEnc = Poseidon.processPoseidonEncryption({
      inputs: [remainingBal],
      publicKey: senderPK,
      nonce: 303n,
    });

    const proof = generateMockTransferProof(senderPK, recipientPK, auditorPK);

    return {
      proof,
      balancePCT: balanceEnc.auditorPCT,
      receiverEncryptedAmount: receiverEnc.auditorPCT,
      auditorPCT: auditorEnc.auditorPCT,
    };
  }

  async executeBatchTransfers(params: {
    batchId: `0x${string}`;
    transfers: Array<{ recipient: `0x${string}`; amount: bigint }>;
    senderPrivateKey: `0x${string}`;
  }): Promise<{ txHashes: `0x${string}`[]; receiptStatuses: number[] }> {
    const senderAddr = TEST_ACCOUNTS.employer.address.toLowerCase() as `0x${string}`;
    let currentSenderBal = this.balances.get(senderAddr) ?? 0n;

    const totalBatchAmount = params.transfers.reduce((acc, t) => acc + t.amount, 0n);
    if (currentSenderBal < totalBatchAmount) {
      throw new Error("executeBatchTransfers: Insufficient balance for entire batch");
    }

    const txHashes: `0x${string}`[] = [];
    const receiptStatuses: number[] = [];

    for (const item of params.transfers) {
      const recAddr = item.recipient.toLowerCase() as `0x${string}`;
      const prep = await this.preparePayrollTransfer({
        senderPrivateKey: params.senderPrivateKey,
        recipientAddress: recAddr,
        amount: item.amount,
        senderBalance: currentSenderBal,
        auditorAddress: this.auditorAddress,
      });

      // Submit on-chain transfer with zero plaintext calldata (proof + ciphertext handles)
      const receipt = this.rpc.submitTransaction({
        from: senderAddr,
        to: this.tokenAddress,
        data: `0xtransferPrivate-${recAddr.slice(2, 10)}-${prep.proof.publicSignals[0].slice(0, 8)}-${prep.balancePCT[0].slice(0, 8)}`,
        executionFn: () => {
          // Update homomorphic balance states
          currentSenderBal -= item.amount;
          this.balances.set(senderAddr, currentSenderBal);
          const currentRecBal = this.balances.get(recAddr) ?? 0n;
          this.balances.set(recAddr, currentRecBal + item.amount);

          const log: Omit<SimulatedLog, "blockNumber" | "transactionHash" | "logIndex"> = {
            address: this.tokenAddress,
            topics: [
              "0xPrivateTransfer",
              senderAddr,
              recAddr,
              this.auditorAddress.toLowerCase(),
            ],
            // ZERO PLAINTEXT: data contains only auditorPCT ciphertext array!
            data: `0x${prep.auditorPCT.map((p) => BigInt(p).toString(16).padStart(64, "0")).join("")}`,
            eventName: "PrivateTransfer",
            args: {
              from: senderAddr,
              to: recAddr,
              auditorPCT: prep.auditorPCT,
              auditorAddress: this.auditorAddress,
            },
          };

          return { status: 1, logs: [log] };
        },
      });

      txHashes.push(receipt.transactionHash);
      receiptStatuses.push(receipt.status);
    }

    return { txHashes, receiptStatuses };
  }

  async auditorDecrypt(
    auditorPrivateKey: string,
    fromBlock?: bigint
  ): Promise<Array<{
    txHash: `0x${string}`;
    amount: bigint;
    sender: `0x${string}`;
    recipient: `0x${string}`;
    blockNumber: bigint;
  }>> {
    const auditorKeyBigInt = BigInt(auditorPrivateKey);
    const logs = this.rpc.getLogs({
      address: this.tokenAddress,
      eventName: "PrivateTransfer",
      fromBlock,
    });

    const results: Array<{
      txHash: `0x${string}`;
      amount: bigint;
      sender: `0x${string}`;
      recipient: `0x${string}`;
      blockNumber: bigint;
    }> = [];

    for (const log of logs) {
      const auditorPCT: string[] = log.args?.auditorPCT;
      if (!auditorPCT || auditorPCT.length !== 7) continue;

      const decryptedAmount = Poseidon.decryptAuditorPCT(auditorKeyBigInt, auditorPCT);
      results.push({
        txHash: log.transactionHash,
        amount: decryptedAmount,
        sender: log.args?.from,
        recipient: log.args?.to,
        blockNumber: log.blockNumber,
      });
    }

    return results;
  }

  setAuditor(newAuditorAddress: `0x${string}`, newAuditorPK: Point): void {
    this.auditorAddress = newAuditorAddress;
    this.auditorPK = newAuditorPK;
  }
}
