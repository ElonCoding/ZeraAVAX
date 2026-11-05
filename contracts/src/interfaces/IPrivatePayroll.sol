// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IPrivatePayroll
/// @notice Payroll coordinator interface for confidential batch lifecycle tracking on Avalanche L1
interface IPrivatePayroll {
    enum BatchStatus {
        None,
        Draft,
        Ready,
        Submitted,
        Confirmed,
        Cancelled
    }

    struct PayrollBatch {
        bytes32 batchId;
        address employer;
        address eercToken;
        uint32 employeeCount;
        BatchStatus status;
        bytes32 rosterCommitment; // Cryptographic hash/merkleRoot of recipients and encrypted amounts
        uint64 createdAt;
        uint64 confirmedAt;
    }

    struct BatchExecutionParams {
        bytes32 batchId;
        address[] recipients;
        uint256 tokenId;
        bytes[] proofData; // Encoded TransferProof and balancePCT for each transfer
    }

    // Events (STRICT ZERO-PLAINTEXT LEAKAGE - NO SALARIES OR AMOUNTS LOGGED)
    event BatchCreated(
        bytes32 indexed batchId,
        address indexed employer,
        address indexed eercToken,
        uint32 employeeCount,
        bytes32 rosterCommitment
    );

    event BatchReady(
        bytes32 indexed batchId,
        address indexed employer,
        uint64 timestamp
    );

    event BatchSubmitted(
        bytes32 indexed batchId,
        address indexed employer,
        uint64 timestamp
    );

    event BatchConfirmed(
        bytes32 indexed batchId,
        address indexed employer,
        uint32 executedCount,
        uint64 timestamp
    );

    event BatchCancelled(
        bytes32 indexed batchId,
        address indexed employer,
        string reason
    );

    // Lifecycle Management
    function createPayrollBatch(
        bytes32 batchId,
        address eercToken,
        uint32 employeeCount,
        bytes32 rosterCommitment
    ) external;

    function markBatchReady(bytes32 batchId) external;

    function submitBatch(bytes32 batchId) external;

    function confirmBatchExecution(
        bytes32 batchId,
        uint32 executedCount
    ) external;

    function cancelBatch(
        bytes32 batchId,
        string calldata reason
    ) external;

    function getBatch(bytes32 batchId) external view returns (PayrollBatch memory);
    function isBatchExecuted(bytes32 batchId) external view returns (bool);
}
