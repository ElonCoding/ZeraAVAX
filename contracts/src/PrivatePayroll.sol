// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPrivatePayroll.sol";

/// @title PrivatePayroll
/// @notice Production-quality payroll batch coordinator enforcing employer authorization,
///         batch lifecycle integrity, idempotency, replay protection, and strict zero-plaintext salary privacy.
contract PrivatePayroll is IPrivatePayroll {
    // Custom Errors
    error BatchAlreadyExists(bytes32 batchId);
    error BatchDoesNotExist(bytes32 batchId);
    error InvalidBatchParameters(string reason);
    error UnauthorizedCaller(address caller, address expected);
    error InvalidStateTransition(BatchStatus currentStatus, BatchStatus targetStatus);
    error BatchAlreadyTerminal(bytes32 batchId, BatchStatus status);

    // State Storage
    mapping(bytes32 => PayrollBatch) private _batches;
    bytes32[] private _allBatchIds;
    mapping(address => bytes32[]) private _employerBatches;

    /// @notice Modifier enforcing caller is the authorized employer for the batch
    modifier onlyEmployer(bytes32 batchId) {
        PayrollBatch storage batch = _batches[batchId];
        if (batch.status == BatchStatus.None) {
            revert BatchDoesNotExist(batchId);
        }
        if (msg.sender != batch.employer) {
            revert UnauthorizedCaller(msg.sender, batch.employer);
        }
        _;
    }

    /// @notice Creates a new confidential payroll batch in Draft state
    /// @param batchId Unique identifier for the batch (replay protection)
    /// @param eercToken Address of the confidential eERC token used for settlement
    /// @param employeeCount Number of recipient employees in this batch
    /// @param rosterCommitment Cryptographic commitment (e.g. Poseidon/Keccak hash) of recipient addresses & encrypted amounts
    function createPayrollBatch(
        bytes32 batchId,
        address eercToken,
        uint32 employeeCount,
        bytes32 rosterCommitment
    ) external override {
        if (batchId == bytes32(0)) {
            revert InvalidBatchParameters("Batch ID cannot be zero");
        }
        if (eercToken == address(0)) {
            revert InvalidBatchParameters("Token address cannot be zero");
        }
        if (employeeCount == 0) {
            revert InvalidBatchParameters("Employee count must be greater than zero");
        }
        if (rosterCommitment == bytes32(0)) {
            revert InvalidBatchParameters("Commitment cannot be zero");
        }
        if (_batches[batchId].status != BatchStatus.None) {
            revert BatchAlreadyExists(batchId);
        }

        PayrollBatch storage batch = _batches[batchId];
        batch.batchId = batchId;
        batch.employer = msg.sender;
        batch.eercToken = eercToken;
        batch.employeeCount = employeeCount;
        batch.status = BatchStatus.Draft;
        batch.rosterCommitment = rosterCommitment;
        // casting to uint64 is safe because block.timestamp will not exceed 2^64-1 in our epoch
        // forge-lint: disable-next-line(unsafe-typecast)
        batch.createdAt = uint64(block.timestamp);
        batch.confirmedAt = 0;

        _allBatchIds.push(batchId);
        _employerBatches[msg.sender].push(batchId);

        emit BatchCreated(
            batchId,
            msg.sender,
            eercToken,
            employeeCount,
            rosterCommitment
        );
    }

    /// @notice Marks a Draft batch as Ready after client-side preflight and proof preparation
    /// @param batchId The unique identifier of the payroll batch
    function markBatchReady(bytes32 batchId) external override onlyEmployer(batchId) {
        PayrollBatch storage batch = _batches[batchId];
        if (batch.status != BatchStatus.Draft) {
            revert InvalidStateTransition(batch.status, BatchStatus.Ready);
        }

        batch.status = BatchStatus.Ready;
        // casting to uint64 is safe because block.timestamp will not exceed 2^64-1
        // forge-lint: disable-next-line(unsafe-typecast)
        emit BatchReady(batchId, msg.sender, uint64(block.timestamp));
    }

    /// @notice Submits a Ready batch for on-chain confidential transaction execution
    /// @param batchId The unique identifier of the payroll batch
    function submitBatch(bytes32 batchId) external override onlyEmployer(batchId) {
        PayrollBatch storage batch = _batches[batchId];
        if (batch.status != BatchStatus.Ready) {
            revert InvalidStateTransition(batch.status, BatchStatus.Submitted);
        }

        batch.status = BatchStatus.Submitted;
        // casting to uint64 is safe because block.timestamp will not exceed 2^64-1
        // forge-lint: disable-next-line(unsafe-typecast)
        emit BatchSubmitted(batchId, msg.sender, uint64(block.timestamp));
    }

    /// @notice Confirms successful execution of all batch transactions on the eERC contract
    /// @param batchId The unique identifier of the payroll batch
    /// @param executedCount Total number of successful confidential transfers executed
    function confirmBatchExecution(
        bytes32 batchId,
        uint32 executedCount
    ) external override onlyEmployer(batchId) {
        PayrollBatch storage batch = _batches[batchId];
        if (batch.status != BatchStatus.Submitted) {
            revert InvalidStateTransition(batch.status, BatchStatus.Confirmed);
        }
        if (executedCount == 0 || executedCount > batch.employeeCount) {
            revert InvalidBatchParameters("Invalid executed count");
        }

        batch.status = BatchStatus.Confirmed;
        // casting to uint64 is safe because block.timestamp will not exceed 2^64-1
        // forge-lint: disable-next-line(unsafe-typecast)
        batch.confirmedAt = uint64(block.timestamp);

        emit BatchConfirmed(
            batchId,
            msg.sender,
            executedCount,
            batch.confirmedAt
        );
    }

    /// @notice Cancels an unconfirmed payroll batch
    /// @param batchId The unique identifier of the payroll batch
    /// @param reason Explanation for cancellation
    function cancelBatch(
        bytes32 batchId,
        string calldata reason
    ) external override onlyEmployer(batchId) {
        PayrollBatch storage batch = _batches[batchId];
        if (batch.status == BatchStatus.Confirmed || batch.status == BatchStatus.Cancelled) {
            revert BatchAlreadyTerminal(batchId, batch.status);
        }

        batch.status = BatchStatus.Cancelled;
        emit BatchCancelled(batchId, msg.sender, reason);
    }

    /// @notice Retrieves the batch details by batchId
    /// @param batchId The batch identifier
    function getBatch(bytes32 batchId) external view override returns (PayrollBatch memory) {
        PayrollBatch storage batch = _batches[batchId];
        if (batch.status == BatchStatus.None) {
            revert BatchDoesNotExist(batchId);
        }
        return batch;
    }

    /// @notice Returns true if the batch has reached the terminal Confirmed state
    /// @param batchId The batch identifier
    function isBatchExecuted(bytes32 batchId) external view override returns (bool) {
        return _batches[batchId].status == BatchStatus.Confirmed;
    }

    /// @notice Returns all batch IDs created by a given employer
    /// @param employer The employer wallet address
    function getEmployerBatches(address employer) external view returns (bytes32[] memory) {
        return _employerBatches[employer];
    }

    /// @notice Returns total number of batches registered in the contract
    function totalBatches() external view returns (uint256) {
        return _allBatchIds.length;
    }

    /// @notice Returns all batch IDs
    function getAllBatchIds() external view returns (bytes32[] memory) {
        return _allBatchIds;
    }
}
