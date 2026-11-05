// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PrivatePayroll.sol";
import "../src/ComplianceVerifier.sol";
import "../src/mock/MockRegistrar.sol";
import "../src/mock/MockEncryptedERC.sol";
import "../src/interfaces/IEncryptedERC.sol";

contract eERCIntegrationTest is Test {
    MockRegistrar public registrar;
    MockEncryptedERC public eercToken;
    ComplianceVerifier public verifier;
    PrivatePayroll public payroll;

    address public deployer = address(0xAA01);
    address public employer = address(0xBB01);
    address public employeeA = address(0xCC01);
    address public employeeB = address(0xCC02);
    address public auditor = address(0xDD01);
    address public observer = address(0xEE01);

    // BabyJubjub Edwards Curve mock public keys (X, Y)
    uint256[2] public employerPubKey = [
        0x1a87e5b20464f16db20573e0a169b14e6d425712ad6ba67e89e0fb72472473ff,
        0x2d18728be26c11b158025ab2eb986bfaec989c968f9b9a6d0abecba6ecfb912f
    ];
    uint256[2] public employeeAPubKey = [
        0x0c9325983ee2ea31df0a876798abf10640df18ba8b4b45561a8ef1092e621dd1,
        0x1e36780963d3f9b2d3bf98b1b8cb83777d13e312fb2762a466487e8340d21054
    ];
    uint256[2] public employeeBPubKey = [
        0x19dfa9f731c03bf05494d4d1e21b8bbf4b334237190eb858c4fef94c6fefd123,
        0x098fa874c728394b928374a89df2374b6283746a827364b9a827364b9a827364
    ];
    uint256[2] public auditorPubKey = [
        0x2b87463921b764c5829103e874b5c6d92837461a29384756b1029384756c1029,
        0x1192837465019283746501928374650192837465019283746501928374650192
    ];

    bytes32 public batchId = keccak256("2026-11-PAYROLL-BIWEEKLY-01");

    function setUp() public {
        vm.startPrank(deployer);

        // 1. Deploy Infrastructure
        registrar = new MockRegistrar();
        eercToken = new MockEncryptedERC(address(registrar));
        verifier = new ComplianceVerifier();
        payroll = new PrivatePayroll();

        // 2. Authorize Auditor in ComplianceVerifier
        verifier.registerAuditor(auditor, "Avalanche Financial Compliance Authority");

        vm.stopPrank();

        // 3. Register BabyJub public keys on Registrar
        registrar.registerPublicKey(employer, employerPubKey);
        registrar.registerPublicKey(employeeA, employeeAPubKey);
        registrar.registerPublicKey(employeeB, employeeBPubKey);
        registrar.registerPublicKey(auditor, auditorPubKey);

        // 4. Configure Token Contract Auditor
        eercToken.setAuditorPublicKey(auditor);
    }

    function test_EndToEnd_PrivatePayroll_Workflow() public {
        // Step 1: Pre-requisite assertions
        assertEq(eercToken.auditor(), auditor);
        uint256[2] memory setAuditorKey = eercToken.auditorPublicKey();
        assertEq(setAuditorKey[0], auditorPubKey[0]);
        assertEq(setAuditorKey[1], auditorPubKey[1]);
        assertTrue(verifier.isAuthorizedAuditor(auditor));

        // Step 2: Employer prepares payroll roster commitments
        // Secret salaries: Employee A = 7,500 USDC ($7500), Employee B = 8,200 USDC ($8200)
        // Ciphertexts & Poseidon commitments are computed client-side
        bytes32 cipherCommitmentA = keccak256(abi.encode(employeeA, "ENC(7500)"));
        bytes32 cipherCommitmentB = keccak256(abi.encode(employeeB, "ENC(8200)"));
        bytes32 rosterCommitment = keccak256(abi.encode(cipherCommitmentA, cipherCommitmentB));

        // Step 3: Employer creates Payroll Batch on PrivatePayroll coordinator
        vm.startPrank(employer);

        payroll.createPayrollBatch(batchId, address(eercToken), 2, rosterCommitment);

        IPrivatePayroll.PayrollBatch memory b = payroll.getBatch(batchId);
        assertEq(b.batchId, batchId);
        assertEq(b.employer, employer);
        assertEq(b.employeeCount, 2);
        assertEq(uint8(b.status), uint8(IPrivatePayroll.BatchStatus.Draft));
        assertEq(b.rosterCommitment, rosterCommitment);

        // Step 4: Employer advances lifecycle Draft -> Ready -> Submitted
        payroll.markBatchReady(batchId);
        assertEq(uint8(payroll.getBatch(batchId).status), uint8(IPrivatePayroll.BatchStatus.Ready));

        payroll.submitBatch(batchId);
        assertEq(uint8(payroll.getBatch(batchId).status), uint8(IPrivatePayroll.BatchStatus.Submitted));

        vm.stopPrank();

        // Step 5: Employer executes confidential eERC transfers for each employee
        vm.startPrank(employer);

        // Simulated TransferProof & auditorPCT for Employee A
        TransferProof memory proofA;
        proofA.proofPoints.a = [uint256(1), uint256(2)];
        proofA.proofPoints.b = [[uint256(3), uint256(4)], [uint256(5), uint256(6)]];
        proofA.proofPoints.c = [uint256(7), uint256(8)];
        // Set auditorPCT in public signals indices 18..24
        proofA.publicSignals[18] = 0xAA01;
        proofA.publicSignals[19] = 0xAA02;
        proofA.publicSignals[20] = 0xAA03;
        proofA.publicSignals[21] = 0xAA04;
        proofA.publicSignals[22] = 0xAA05;
        proofA.publicSignals[23] = 0xAA06;
        proofA.publicSignals[24] = 0xAA07;

        uint256[7] memory balancePCTA = [uint256(10), 11, 12, 13, 14, 15, 16];

        // Record logs to assert PrivateTransfer event emission
        vm.recordLogs();
        eercToken.transfer(employeeA, 1, proofA, balancePCTA, "PAYROLL-NOV-A");

        // Verify transfer to Employee B
        TransferProof memory proofB;
        proofB.publicSignals[18] = 0xBB01;
        proofB.publicSignals[19] = 0xBB02;
        proofB.publicSignals[20] = 0xBB03;
        proofB.publicSignals[21] = 0xBB04;
        proofB.publicSignals[22] = 0xBB05;
        proofB.publicSignals[23] = 0xBB06;
        proofB.publicSignals[24] = 0xBB07;
        uint256[7] memory balancePCTB = [uint256(20), 21, 22, 23, 24, 25, 26];

        eercToken.transfer(employeeB, 1, proofB, balancePCTB, "PAYROLL-NOV-B");

        // Step 6: Employer confirms batch execution on PrivatePayroll coordinator
        payroll.confirmBatchExecution(batchId, 2);
        assertTrue(payroll.isBatchExecuted(batchId));

        vm.stopPrank();

        // Step 7: Auditor verifies on-chain logs
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertGt(logs.length, 0);

        // Confirm PrivateTransfer emitted with auditor address
        bool foundPrivateTransferA = false;
        bytes32 privateTransferSig = keccak256("PrivateTransfer(address,address,uint256[7],address)");

        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length > 0 && logs[i].topics[0] == privateTransferSig) {
                // Topic 1 = from (employer), Topic 2 = to, Topic 3 = auditorAddress
                address loggedAuditor = address(uint160(uint256(logs[i].topics[3])));
                assertEq(loggedAuditor, auditor);
                foundPrivateTransferA = true;
            }
        }
        assertTrue(foundPrivateTransferA, "PrivateTransfer event with auditor not found!");

        // Step 8: Auditor posts Compliance Attestation
        bytes32 auditReportHash = keccak256(abi.encodePacked("AUDIT-CLEARED-BATCH-01", batchId, block.timestamp));

        vm.prank(auditor);
        verifier.attestCompliance(batchId, auditReportHash, true);

        IComplianceVerifier.ComplianceAttestation memory att = verifier.getAttestation(batchId, auditor);
        assertEq(att.batchId, batchId);
        assertEq(att.auditor, auditor);
        assertEq(att.reportHash, auditReportHash);
        assertTrue(att.isCompliant);

        // Step 9: Public Observer view verification
        // Observer queries PrivatePayroll: zero plaintext numbers exist
        IPrivatePayroll.PayrollBatch memory publicBatch = payroll.getBatch(batchId);
        assertEq(publicBatch.employeeCount, 2);
        assertEq(uint8(publicBatch.status), uint8(IPrivatePayroll.BatchStatus.Confirmed));
        assertEq(publicBatch.rosterCommitment, rosterCommitment);

        // Observer cannot discover individual employee salaries
        // The confidential amounts 7500 and 8200 never touched on-chain storage or events
    }
}
