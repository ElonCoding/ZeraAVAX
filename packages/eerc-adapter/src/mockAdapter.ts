/**
 * Mock eERC Adapter for Deterministic Offline Testing & Simulation.
 * Implements IEERCAdapter with authentic BabyJubjub curve and Poseidon sponge arithmetic.
 */

import { Point, TransferProof } from "@cashlayer/shared";
import { BabyJub, Poseidon, generateMockTransferProof } from "./crypto.js";
import { IEERCAdapter } from "./index.js";

export interface MockTransferRecord {
  txHash: `0x${string}`;
  blockNumber: bigint;
  from: `0x${string}`;
  to: `0x${string}`;
  auditorPCT: string[];
  auditorAddress: `0x${string}`;
  timestamp: number;
}

export class MockEERCAdapter implements IEERCAdapter {
  public tokenAddress: `0x${string}` = "0xcccccccccccccccccccccccccccccccccccccccc";
  public registrarAddress: `0x${string}` = "0xdddddddddddddddddddddddddddddddddddddddd";
  public auditorAddress: `0x${string}` = "0x7777777777777777777777777777777777777777";
  public auditorPK: Point = BabyJub.generatePublicKey(70000001n);

  private registeredKeys: Map<string, Point> = new Map();
  private privateKeys: Map<string, bigint> = new Map();
  private balances: Map<string, bigint> = new Map();
  private logs: MockTransferRecord[] = [];
  private currentBlock: bigint = 1n;
  private txCounter: number = 0;

  constructor(options?: {
    tokenAddress?: `0x${string}`;
    registrarAddress?: `0x${string}`;
    auditorAddress?: `0x${string}`;
    auditorPK?: Point;
  }) {
    if (options?.tokenAddress) this.tokenAddress = options.tokenAddress;
    if (options?.registrarAddress) this.registrarAddress = options.registrarAddress;
    if (options?.auditorAddress) this.auditorAddress = options.auditorAddress;
    if (options?.auditorPK) this.auditorPK = options.auditorPK;
  }

  async initialize(
    rpcUrl: string,
    tokenAddress: `0x${string}`,
    registrarAddress?: `0x${string}`
  ): Promise<void> {
    if (!rpcUrl) {
      throw new Error("eERCAdapter: RPC URL is required");
    }
    this.tokenAddress = tokenAddress;
    if (registrarAddress) this.registrarAddress = registrarAddress;
  }

  async registerAccount(
    privateKey: `0x${string}`
  ): Promise<{ publicKey: [bigint, bigint]; txHash?: `0x${string}` }> {
    const sk = BabyJub.deriveSecretKey(privateKey);
    const pk = BabyJub.generatePublicKey(sk);

    // Derive deterministic EVM address from private key if not full address
    const mockAddr = `0x${privateKey.slice(2, 42).padEnd(40, "0")}`.toLowerCase() as `0x${string}`;
    this.registeredKeys.set(mockAddr, pk);
    this.privateKeys.set(mockAddr, sk);

    this.txCounter++;
    this.currentBlock++;
    const txHash = `0x${this.txCounter.toString(16).padStart(64, "0")}` as `0x${string}`;

    return { publicKey: pk, txHash };
  }

  async getEncryptedBalance(
    userAddress: `0x${string}`,
    viewingKey?: string
  ): Promise<{ encrypted: [bigint, bigint, bigint, bigint]; decrypted?: bigint }> {
    const addr = userAddress.toLowerCase();
    const bal = this.balances.get(addr) ?? 0n;
    const pk = this.registeredKeys.get(addr) ?? BabyJub.Base8;

    // Encrypted handle representation (c1.x, c1.y, c2.x, c2.y)
    const eg = BabyJub.mulWithScalar(pk, bal + 100n);
    const encrypted: [bigint, bigint, bigint, bigint] = [
      BabyJub.Base8[0],
      BabyJub.Base8[1],
      eg[0],
      eg[1],
    ];

    let decrypted: bigint | undefined = undefined;
    if (viewingKey !== undefined) {
      const storedKey = this.privateKeys.get(addr);
      if (storedKey !== undefined && storedKey.toString() === viewingKey) {
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

    const recAddr = params.recipientAddress.toLowerCase();
    const recipientPK = this.registeredKeys.get(recAddr);
    if (!recipientPK) {
      throw new Error(`preparePayrollTransfer: Recipient ${params.recipientAddress} is not registered`);
    }

    const senderSk = BabyJub.deriveSecretKey(params.senderPrivateKey);
    const senderPK = BabyJub.generatePublicKey(senderSk);
    const auditorPK = this.auditorPK;

    // Authentic Poseidon encryptions
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

    const proof = generateMockTransferProof(senderPK, recipientPK, auditorPK, params.amount);

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
    const senderAddr = `0x${params.senderPrivateKey.slice(2, 42).padEnd(40, "0")}`.toLowerCase() as `0x${string}`;
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

      // Update state
      currentSenderBal -= item.amount;
      this.balances.set(senderAddr, currentSenderBal);
      const curRecBal = this.balances.get(recAddr) ?? 0n;
      this.balances.set(recAddr, curRecBal + item.amount);

      this.txCounter++;
      this.currentBlock++;
      const txHash = `0x${this.txCounter.toString(16).padStart(64, "0")}` as `0x${string}`;

      this.logs.push({
        txHash,
        blockNumber: this.currentBlock,
        from: senderAddr,
        to: recAddr,
        auditorPCT: prep.auditorPCT,
        auditorAddress: this.auditorAddress.toLowerCase() as `0x${string}`,
        timestamp: Math.floor(Date.now() / 1000),
      });

      txHashes.push(txHash);
      receiptStatuses.push(1);
    }

    return { txHashes, receiptStatuses };
  }

  async auditorDecrypt(
    auditorPrivateKey: string,
    fromBlock?: bigint
  ): Promise<
    Array<{
      txHash: `0x${string}`;
      amount: bigint;
      sender: `0x${string}`;
      recipient: `0x${string}`;
      blockNumber: bigint;
    }>
  > {
    const auditorKeyBigInt = BigInt(auditorPrivateKey);
    const filteredLogs = this.logs.filter((log) => {
      if (fromBlock !== undefined && log.blockNumber < fromBlock) return false;
      return true;
    });

    const results: Array<{
      txHash: `0x${string}`;
      amount: bigint;
      sender: `0x${string}`;
      recipient: `0x${string}`;
      blockNumber: bigint;
    }> = [];

    for (const log of filteredLogs) {
      if (!log.auditorPCT || log.auditorPCT.length !== 7) continue;
      const decryptedAmount = Poseidon.decryptAuditorPCT(auditorKeyBigInt, log.auditorPCT);
      results.push({
        txHash: log.txHash,
        amount: decryptedAmount,
        sender: log.from,
        recipient: log.to,
        blockNumber: log.blockNumber,
      });
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Helper Configuration Methods for Deterministic Tests
  // -------------------------------------------------------------------------

  registerAccountExplicit(address: `0x${string}`, secretKey: bigint, publicKey: Point): void {
    const addr = address.toLowerCase();
    this.registeredKeys.set(addr, publicKey);
    this.privateKeys.set(addr, secretKey);
  }

  setBalance(address: `0x${string}`, balance: bigint): void {
    this.balances.set(address.toLowerCase(), balance);
  }

  setAuditor(newAuditorAddress: `0x${string}`, newAuditorPK: Point): void {
    this.auditorAddress = newAuditorAddress;
    this.auditorPK = newAuditorPK;
  }

  getRegisteredPublicKey(address: `0x${string}`): Point | undefined {
    return this.registeredKeys.get(address.toLowerCase());
  }

  getLogs(): MockTransferRecord[] {
    return [...this.logs];
  }
}
