/**
 * High-Fidelity Avalanche L1 JSON-RPC Provider Simulation for E2E Tests.
 * Emulates transaction execution, receipt indexing, block progression, log filtering,
 * and zero-plaintext calldata inspection.
 */

export interface SimulatedLog {
  address: `0x${string}`;
  topics: string[];
  data: string;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
  eventName?: string;
  args?: Record<string, any>;
}

export interface SimulatedReceipt {
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  from: `0x${string}`;
  to: `0x${string}`;
  status: 1 | 0; // 1 = success, 0 = reverted
  gasUsed: bigint;
  logs: SimulatedLog[];
  revertReason?: string;
}

export interface SimulatedTransaction {
  hash: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}`;
  data: string;
  value: bigint;
  blockNumber: bigint;
  nonce: number;
}

export class MockAvalancheRPC {
  private chainId: number = 43114; // Avalanche L1 CashLayer
  private blockNumber: bigint = 1000n;
  private transactions: Map<`0x${string}`, SimulatedTransaction> = new Map();
  private receipts: Map<`0x${string}`, SimulatedReceipt> = new Map();
  private logs: SimulatedLog[] = [];
  private nonces: Map<`0x${string}`, number> = new Map();

  constructor(chainId: number = 43114) {
    this.chainId = chainId;
  }

  getChainId(): number {
    return this.chainId;
  }

  getBlockNumber(): bigint {
    return this.blockNumber;
  }

  mineBlock(): bigint {
    this.blockNumber += 1n;
    return this.blockNumber;
  }

  getNextNonce(account: `0x${string}`): number {
    const current = this.nonces.get(account.toLowerCase() as `0x${string}`) ?? 0;
    return current;
  }

  submitTransaction(params: {
    from: `0x${string}`;
    to: `0x${string}`;
    data: string;
    gasLimit?: bigint;
    value?: bigint;
    executionFn?: () => { status: 1 | 0; logs: Omit<SimulatedLog, 'blockNumber' | 'transactionHash' | 'logIndex'>[]; revertReason?: string };
  }): SimulatedReceipt {
    const fromAddr = params.from.toLowerCase() as `0x${string}`;
    const toAddr = params.to.toLowerCase() as `0x${string}`;
    const nonce = this.getNextNonce(fromAddr);
    this.nonces.set(fromAddr, nonce + 1);

    this.mineBlock();
    const currentBlock = this.blockNumber;

    // Generate deterministic hash
    const rawData = `${fromAddr}-${toAddr}-${nonce}-${currentBlock}-${params.data.slice(0, 32)}`;
    let hashNum = 0xabcdef0123456789n;
    for (let i = 0; i < rawData.length; i++) {
      hashNum = (hashNum * 131n + BigInt(rawData.charCodeAt(i))) & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
    }
    const txHash = `0x${hashNum.toString(16).padStart(64, "0")}` as `0x${string}`;

    const tx: SimulatedTransaction = {
      hash: txHash,
      from: fromAddr,
      to: toAddr,
      data: params.data,
      value: params.value ?? 0n,
      blockNumber: currentBlock,
      nonce,
    };
    this.transactions.set(txHash, tx);

    let status: 1 | 0 = 1;
    let revertReason: string | undefined;
    const logsToEmit: SimulatedLog[] = [];

    if (params.executionFn) {
      try {
        const result = params.executionFn();
        status = result.status;
        revertReason = result.revertReason;
        if (status === 1) {
          result.logs.forEach((l, idx) => {
            const fullLog: SimulatedLog = {
              ...l,
              blockNumber: currentBlock,
              transactionHash: txHash,
              logIndex: this.logs.length + idx,
            };
            logsToEmit.push(fullLog);
            this.logs.push(fullLog);
          });
        }
      } catch (err: any) {
        status = 0;
        revertReason = err?.message || "Execution reverted";
      }
    }

    const receipt: SimulatedReceipt = {
      transactionHash: txHash,
      blockNumber: currentBlock,
      from: fromAddr,
      to: toAddr,
      status,
      gasUsed: status === 1 ? (params.gasLimit ?? 420000n) : 21000n,
      logs: logsToEmit,
      revertReason,
    };

    this.receipts.set(txHash, receipt);
    return receipt;
  }

  getTransaction(hash: `0x${string}`): SimulatedTransaction | undefined {
    return this.transactions.get(hash);
  }

  getTransactionReceipt(hash: `0x${string}`): SimulatedReceipt | undefined {
    return this.receipts.get(hash);
  }

  getLogs(filter: {
    address?: `0x${string}`;
    fromBlock?: bigint;
    toBlock?: bigint;
    eventName?: string;
  }): SimulatedLog[] {
    return this.logs.filter((log) => {
      if (filter.address && log.address.toLowerCase() !== filter.address.toLowerCase()) {
        return false;
      }
      if (filter.fromBlock !== undefined && log.blockNumber < filter.fromBlock) {
        return false;
      }
      if (filter.toBlock !== undefined && log.blockNumber > filter.toBlock) {
        return false;
      }
      if (filter.eventName && log.eventName !== filter.eventName) {
        return false;
      }
      return true;
    });
  }

  /**
   * Asserts that neither transaction calldata nor emitted event logs
   * leak sensitive values (e.g. plaintext salary amounts).
   */
  assertZeroPlaintextLeakage(txHash: `0x${string}`, sensitiveValues: bigint[]): {
    leaked: boolean;
    leakEvidence?: string;
  } {
    const tx = this.transactions.get(txHash);
    const receipt = this.receipts.get(txHash);
    if (!tx || !receipt) {
      throw new Error(`Transaction ${txHash} not found in RPC index`);
    }

    for (const val of sensitiveValues) {
      if (val === 0n) continue; // Skip zero
      const decStr = val.toString();
      const hexStr = val.toString(16).toLowerCase();
      const wordHex = hexStr.padStart(64, "0");

      // Check transaction calldata (both ABI word and decoded UTF-8 string)
      let txUtf8 = "";
      try {
        txUtf8 = Buffer.from(tx.data.startsWith("0x") ? tx.data.slice(2) : tx.data, "hex").toString("utf8");
      } catch {}

      if (tx.data.toLowerCase().includes(wordHex) || txUtf8.includes(decStr)) {
        return {
          leaked: true,
          leakEvidence: `Plaintext value ${decStr} (0x${hexStr}) found in transaction calldata: ${tx.data.slice(0, 80)}...`,
        };
      }

      // Check event logs data and topics
      for (const log of receipt.logs) {
        let logUtf8 = "";
        try {
          logUtf8 = Buffer.from(log.data.startsWith("0x") ? log.data.slice(2) : log.data, "hex").toString("utf8");
        } catch {}

        if (log.data.toLowerCase().includes(wordHex) || logUtf8.includes(decStr)) {
          return {
            leaked: true,
            leakEvidence: `Plaintext value ${decStr} (0x${hexStr}) found in event log data: ${log.data.slice(0, 80)}...`,
          };
        }
        for (const topic of log.topics) {
          if (topic.toLowerCase().includes(wordHex)) {
            return {
              leaked: true,
              leakEvidence: `Plaintext value ${decStr} found in log topic: ${topic}`,
            };
          }
        }
      }
    }

    return { leaked: false };
  }

  reset(): void {
    this.blockNumber = 1000n;
    this.transactions.clear();
    this.receipts.clear();
    this.logs = [];
    this.nonces.clear();
  }
}
