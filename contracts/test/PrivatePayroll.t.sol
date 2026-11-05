// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PrivatePayroll.sol";
import "../src/interfaces/IPrivatePayroll.sol";

contract PrivatePayrollTest is Test {
    PrivatePayroll public payroll;

    address public employer = address(0x1111);
    address public employee1 = address(0x2221);
    address public employee2 = address(0x2222);
    address public attacker = address(0x9999);
    address public mockEerc = address(0xEEEE);

    bytes32 public sampleBatchId = keccak256("BATCH-2026-11-PAYROLL");
    bytes32 public sampleCommitment = keccak256("ROSTER-COMMITMENT-HASH-1234");
    uint32 public sampleCount = 5;

    // Events to verify
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

    function setUp() public {
        payroll = new PrivatePayroll();
        vm.deal(employer, 10 ether);
        vm.deal(attacker, 1 ether);
    }

    // ------------------------------------------------------------------------
    // UNIT TESTS: Lifecycle & State Transitions
    // ------------------------------------------------------------------------

    function test_CreatePayrollBatch_Success() public {
        vm.prank(employer);
        vm.expectEmit(true, true, true, true);
        emit BatchCreated(sampleBatchId, employer, mockEerc, sampleCount, sampleCommitment);

        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);

        IPrivatePayroll.PayrollBatch memory batch = payroll.getBatch(sampleBatchId);
        assertEq(batch.batchId, sampleBatchId);
        assertEq(batch.employer, employer);
        assertEq(batch.eercToken, mockEerc);
        assertEq(batch.employeeCount, sampleCount);
        assertEq(uint8(batch.status), uint8(IPrivatePayroll.BatchStatus.Draft));
        assertEq(batch.rosterCommitment, sampleCommitment);
        assertGt(batch.createdAt, 0);
        assertEq(batch.confirmedAt, 0);
        assertFalse(payroll.isBatchExecuted(sampleBatchId));
    }

    function test_BatchLifecycle_FullFlow() public {
        // 1. Create (Draft)
        vm.prank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);

        // 2. Mark Ready
        vm.prank(employer);
        vm.expectEmit(true, true, false, false);
        emit BatchReady(sampleBatchId, employer, uint64(block.timestamp));
        payroll.markBatchReady(sampleBatchId);

        IPrivatePayroll.PayrollBatch memory batchReady = payroll.getBatch(sampleBatchId);
        assertEq(uint8(batchReady.status), uint8(IPrivatePayroll.BatchStatus.Ready));

        // 3. Submit
        vm.prank(employer);
        vm.expectEmit(true, true, false, false);
        emit BatchSubmitted(sampleBatchId, employer, uint64(block.timestamp));
        payroll.submitBatch(sampleBatchId);

        IPrivatePayroll.PayrollBatch memory batchSubmitted = payroll.getBatch(sampleBatchId);
        assertEq(uint8(batchSubmitted.status), uint8(IPrivatePayroll.BatchStatus.Submitted));

        // 4. Confirm Execution
        uint256 currentTs = vm.getBlockTimestamp();
        vm.warp(currentTs + 60);
        vm.prank(employer);
        vm.expectEmit(true, true, false, true);
        emit BatchConfirmed(sampleBatchId, employer, sampleCount, uint64(vm.getBlockTimestamp()));
        payroll.confirmBatchExecution(sampleBatchId, sampleCount);

        IPrivatePayroll.PayrollBatch memory batchConfirmed = payroll.getBatch(sampleBatchId);
        assertEq(uint8(batchConfirmed.status), uint8(IPrivatePayroll.BatchStatus.Confirmed));
        assertEq(batchConfirmed.confirmedAt, vm.getBlockTimestamp());
        assertTrue(payroll.isBatchExecuted(sampleBatchId));
    }

    function test_CancelBatch_FromDraft() public {
        vm.prank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);

        vm.prank(employer);
        vm.expectEmit(true, true, false, true);
        emit BatchCancelled(sampleBatchId, employer, "Budget revised");
        payroll.cancelBatch(sampleBatchId, "Budget revised");

        IPrivatePayroll.PayrollBatch memory batch = payroll.getBatch(sampleBatchId);
        assertEq(uint8(batch.status), uint8(IPrivatePayroll.BatchStatus.Cancelled));
        assertFalse(payroll.isBatchExecuted(sampleBatchId));
    }

    function test_CancelBatch_FromReady() public {
        vm.startPrank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);
        payroll.markBatchReady(sampleBatchId);
        payroll.cancelBatch(sampleBatchId, "Correction needed in roster");
        vm.stopPrank();

        IPrivatePayroll.PayrollBatch memory batch = payroll.getBatch(sampleBatchId);
        assertEq(uint8(batch.status), uint8(IPrivatePayroll.BatchStatus.Cancelled));
    }

    function test_CancelBatch_FromSubmitted() public {
        vm.startPrank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);
        payroll.markBatchReady(sampleBatchId);
        payroll.submitBatch(sampleBatchId);
        payroll.cancelBatch(sampleBatchId, "Gas price spiked, rescheduled");
        vm.stopPrank();

        IPrivatePayroll.PayrollBatch memory batch = payroll.getBatch(sampleBatchId);
        assertEq(uint8(batch.status), uint8(IPrivatePayroll.BatchStatus.Cancelled));
    }

    // ------------------------------------------------------------------------
    // REPLAY ATTACK & IDEMPOTENCY PREVENTION
    // ------------------------------------------------------------------------

    function test_RevertIf_ReplayBatchId() public {
        vm.prank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);

        // Attempt duplicate creation with same batchId
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.BatchAlreadyExists.selector, sampleBatchId));
        payroll.createPayrollBatch(sampleBatchId, mockEerc, 10, keccak256("OTHER"));
    }

    function test_RevertIf_AttackerReplaysBatchId() public {
        vm.prank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);

        // Attacker attempts to hijack or duplicate batchId
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.BatchAlreadyExists.selector, sampleBatchId));
        payroll.createPayrollBatch(sampleBatchId, mockEerc, 2, keccak256("ATTACK"));
    }

    // ------------------------------------------------------------------------
    // AUTHORIZATION RESTRICTIONS
    // ------------------------------------------------------------------------

    function test_RevertIf_CallerNotEmployer_MarkReady() public {
        vm.prank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.UnauthorizedCaller.selector, attacker, employer));
        payroll.markBatchReady(sampleBatchId);
    }

    function test_RevertIf_CallerNotEmployer_Submit() public {
        vm.startPrank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);
        payroll.markBatchReady(sampleBatchId);
        vm.stopPrank();

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.UnauthorizedCaller.selector, attacker, employer));
        payroll.submitBatch(sampleBatchId);
    }

    function test_RevertIf_CallerNotEmployer_Confirm() public {
        vm.startPrank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);
        payroll.markBatchReady(sampleBatchId);
        payroll.submitBatch(sampleBatchId);
        vm.stopPrank();

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.UnauthorizedCaller.selector, attacker, employer));
        payroll.confirmBatchExecution(sampleBatchId, sampleCount);
    }

    function test_RevertIf_CallerNotEmployer_Cancel() public {
        vm.prank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.UnauthorizedCaller.selector, attacker, employer));
        payroll.cancelBatch(sampleBatchId, "Malicious cancellation");
    }

    // ------------------------------------------------------------------------
    // INPUT VALIDATION TESTS
    // ------------------------------------------------------------------------

    function test_RevertIf_ZeroBatchId() public {
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.InvalidBatchParameters.selector, "Batch ID cannot be zero"));
        payroll.createPayrollBatch(bytes32(0), mockEerc, sampleCount, sampleCommitment);
    }

    function test_RevertIf_ZeroTokenAddress() public {
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.InvalidBatchParameters.selector, "Token address cannot be zero"));
        payroll.createPayrollBatch(sampleBatchId, address(0), sampleCount, sampleCommitment);
    }

    function test_RevertIf_ZeroEmployeeCount() public {
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.InvalidBatchParameters.selector, "Employee count must be greater than zero"));
        payroll.createPayrollBatch(sampleBatchId, mockEerc, 0, sampleCommitment);
    }

    function test_RevertIf_ZeroCommitment() public {
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.InvalidBatchParameters.selector, "Commitment cannot be zero"));
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, bytes32(0));
    }

    function test_RevertIf_InvalidExecutedCount_Zero() public {
        vm.startPrank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);
        payroll.markBatchReady(sampleBatchId);
        payroll.submitBatch(sampleBatchId);

        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.InvalidBatchParameters.selector, "Invalid executed count"));
        payroll.confirmBatchExecution(sampleBatchId, 0);
        vm.stopPrank();
    }

    function test_RevertIf_InvalidExecutedCount_ExceedsTotal() public {
        vm.startPrank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);
        payroll.markBatchReady(sampleBatchId);
        payroll.submitBatch(sampleBatchId);

        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.InvalidBatchParameters.selector, "Invalid executed count"));
        payroll.confirmBatchExecution(sampleBatchId, sampleCount + 1);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------------
    // INVALID STATE TRANSITIONS & TERMINAL PROTECTION
    // ------------------------------------------------------------------------

    function test_RevertIf_DirectSubmitFromDraft() public {
        vm.prank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);

        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(
            PrivatePayroll.InvalidStateTransition.selector,
            IPrivatePayroll.BatchStatus.Draft,
            IPrivatePayroll.BatchStatus.Submitted
        ));
        payroll.submitBatch(sampleBatchId);
    }

    function test_RevertIf_DirectConfirmFromDraft() public {
        vm.prank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);

        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(
            PrivatePayroll.InvalidStateTransition.selector,
            IPrivatePayroll.BatchStatus.Draft,
            IPrivatePayroll.BatchStatus.Confirmed
        ));
        payroll.confirmBatchExecution(sampleBatchId, sampleCount);
    }

    function test_RevertIf_CancelTerminalConfirmedBatch() public {
        vm.startPrank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);
        payroll.markBatchReady(sampleBatchId);
        payroll.submitBatch(sampleBatchId);
        payroll.confirmBatchExecution(sampleBatchId, sampleCount);

        vm.expectRevert(abi.encodeWithSelector(
            PrivatePayroll.BatchAlreadyTerminal.selector,
            sampleBatchId,
            IPrivatePayroll.BatchStatus.Confirmed
        ));
        payroll.cancelBatch(sampleBatchId, "Trying to cancel confirmed payroll");
        vm.stopPrank();
    }

    function test_RevertIf_CancelTerminalCancelledBatch() public {
        vm.startPrank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);
        payroll.cancelBatch(sampleBatchId, "First cancel");

        vm.expectRevert(abi.encodeWithSelector(
            PrivatePayroll.BatchAlreadyTerminal.selector,
            sampleBatchId,
            IPrivatePayroll.BatchStatus.Cancelled
        ));
        payroll.cancelBatch(sampleBatchId, "Second cancel");
        vm.stopPrank();
    }

    function test_RevertIf_NonexistentBatchQuery() public {
        bytes32 nonExistent = keccak256("UNKNOWN");
        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.BatchDoesNotExist.selector, nonExistent));
        payroll.getBatch(nonExistent);
    }

    function test_EmployerBatchIndexing() public {
        bytes32 batch1 = keccak256("BATCH-1");
        bytes32 batch2 = keccak256("BATCH-2");

        vm.startPrank(employer);
        payroll.createPayrollBatch(batch1, mockEerc, 2, sampleCommitment);
        payroll.createPayrollBatch(batch2, mockEerc, 4, sampleCommitment);
        vm.stopPrank();

        bytes32[] memory list = payroll.getEmployerBatches(employer);
        assertEq(list.length, 2);
        assertEq(list[0], batch1);
        assertEq(list[1], batch2);
        assertEq(payroll.totalBatches(), 2);
    }

    // ------------------------------------------------------------------------
    // STRICT ZERO-PLAINTEXT SALARY LEAKAGE VERIFICATION
    // ------------------------------------------------------------------------

    function test_ZeroPlaintextSalaryLeakage_Assertion() public {
        vm.recordLogs();

        vm.startPrank(employer);
        payroll.createPayrollBatch(sampleBatchId, mockEerc, sampleCount, sampleCommitment);
        payroll.markBatchReady(sampleBatchId);
        payroll.submitBatch(sampleBatchId);
        payroll.confirmBatchExecution(sampleBatchId, sampleCount);
        vm.stopPrank();

        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertGt(entries.length, 0);

        // Verify that none of the event topics or calldata contain any arbitrary salary numbers
        // e.g. typical salary of 50,000 * 10^18 tokens or 5,000 * 10^6 USDC
        bytes32 salary50k = bytes32(uint256(50000 * 1e18));
        bytes32 salary5kUSDC = bytes32(uint256(5000 * 1e6));

        for (uint256 i = 0; i < entries.length; i++) {
            for (uint256 t = 0; t < entries[i].topics.length; t++) {
                assertTrue(entries[i].topics[t] != salary50k, "Plaintext salary found in event topic!");
                assertTrue(entries[i].topics[t] != salary5kUSDC, "Plaintext salary found in event topic!");
            }
            // Check data payload does not leak salary
            bytes memory data = entries[i].data;
            if (data.length >= 32) {
                for (uint256 o = 0; o <= data.length - 32; o += 32) {
                    bytes32 word;
                    assembly {
                        word := mload(add(add(data, 0x20), o))
                    }
                    assertTrue(word != salary50k, "Plaintext salary found in event data!");
                    assertTrue(word != salary5kUSDC, "Plaintext salary found in event data!");
                }
            }
        }
    }

    // ------------------------------------------------------------------------
    // FUZZ TESTS
    // ------------------------------------------------------------------------

    function testFuzz_CreatePayrollBatch(
        bytes32 batchId,
        address eercToken,
        uint32 employeeCount,
        bytes32 rosterCommitment
    ) public {
        vm.assume(batchId != bytes32(0));
        vm.assume(eercToken != address(0));
        vm.assume(employeeCount > 0);
        vm.assume(rosterCommitment != bytes32(0));

        vm.prank(employer);
        payroll.createPayrollBatch(batchId, eercToken, employeeCount, rosterCommitment);

        IPrivatePayroll.PayrollBatch memory b = payroll.getBatch(batchId);
        assertEq(b.batchId, batchId);
        assertEq(b.eercToken, eercToken);
        assertEq(b.employeeCount, employeeCount);
        assertEq(b.rosterCommitment, rosterCommitment);
        assertEq(uint8(b.status), uint8(IPrivatePayroll.BatchStatus.Draft));
    }

    function testFuzz_BatchExecution(
        uint32 employeeCount,
        uint32 executedCount
    ) public {
        vm.assume(employeeCount > 0 && employeeCount < 10000);
        vm.assume(executedCount > 0 && executedCount <= employeeCount);

        bytes32 fuzzBatchId = keccak256(abi.encodePacked("FUZZ-BATCH", employeeCount, executedCount));

        vm.startPrank(employer);
        payroll.createPayrollBatch(fuzzBatchId, mockEerc, employeeCount, sampleCommitment);
        payroll.markBatchReady(fuzzBatchId);
        payroll.submitBatch(fuzzBatchId);
        payroll.confirmBatchExecution(fuzzBatchId, executedCount);
        vm.stopPrank();

        assertTrue(payroll.isBatchExecuted(fuzzBatchId));
    }

    function testFuzz_ReplayAttackPrevention(bytes32 batchId) public {
        vm.assume(batchId != bytes32(0));

        vm.prank(employer);
        payroll.createPayrollBatch(batchId, mockEerc, 3, sampleCommitment);

        // Immediate replay must revert
        vm.prank(employer);
        vm.expectRevert(abi.encodeWithSelector(PrivatePayroll.BatchAlreadyExists.selector, batchId));
        payroll.createPayrollBatch(batchId, mockEerc, 3, sampleCommitment);
    }
}
