/**
 * ABI definitions and contract interfaces for CashLayer Private Payroll CLI.
 */

export const PRIVATE_PAYROLL_ABI = [
  {
    type: "function",
    name: "createPayrollBatch",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "eercToken", type: "address" },
      { name: "employeeCount", type: "uint32" },
      { name: "rosterCommitment", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "markBatchReady",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "submitBatch",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "confirmBatchExecution",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "executedCount", type: "uint32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelBatch",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getBatch",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "batchId", type: "bytes32" },
          { name: "employer", type: "address" },
          { name: "eercToken", type: "address" },
          { name: "employeeCount", type: "uint32" },
          { name: "status", type: "uint8" },
          { name: "rosterCommitment", type: "bytes32" },
          { name: "createdAt", type: "uint64" },
          { name: "confirmedAt", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isBatchExecuted",
    inputs: [{ name: "batchId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "BatchCreated",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "employer", type: "address", indexed: true },
      { name: "eercToken", type: "address", indexed: false },
      { name: "employeeCount", type: "uint32", indexed: false },
      { name: "rosterCommitment", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BatchConfirmed",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "employer", type: "address", indexed: true },
      { name: "executedCount", type: "uint32", indexed: false },
      { name: "confirmedAt", type: "uint64", indexed: false },
    ],
  },
] as const;

export const COMPLIANCE_VERIFIER_ABI = [
  {
    type: "function",
    name: "registerAuditor",
    inputs: [
      { name: "auditor", type: "address" },
      { name: "organizationName", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeAuditor",
    inputs: [{ name: "auditor", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "attestCompliance",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "reportHash", type: "bytes32" },
      { name: "isCompliant", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isAuthorizedAuditor",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAttestation",
    inputs: [
      { name: "batchId", type: "bytes32" },
      { name: "auditor", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "batchId", type: "bytes32" },
          { name: "auditor", type: "address" },
          { name: "reportHash", type: "bytes32" },
          { name: "verifiedAt", type: "uint64" },
          { name: "isCompliant", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ComplianceAttested",
    inputs: [
      { name: "batchId", type: "bytes32", indexed: true },
      { name: "auditor", type: "address", indexed: true },
      { name: "reportHash", type: "bytes32", indexed: false },
      { name: "isCompliant", type: "bool", indexed: false },
      { name: "verifiedAt", type: "uint64", indexed: false },
    ],
  },
] as const;

export const DEFAULT_CONTRACT_ADDRESSES = {
  privatePayroll: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`,
  complianceVerifier: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`,
  eercToken: "0xcccccccccccccccccccccccccccccccccccccccc" as `0x${string}`,
  registrar: "0xdddddddddddddddddddddddddddddddddddddddd" as `0x${string}`,
  auditor: "0x7777777777777777777777777777777777777777" as `0x${string}`,
};
