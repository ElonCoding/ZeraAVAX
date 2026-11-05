// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ComplianceVerifier.sol";
import "../src/interfaces/IComplianceVerifier.sol";

contract ComplianceVerifierTest is Test {
    ComplianceVerifier public verifier;

    address public owner = address(0xAA11);
    address public auditor1 = address(0xBB11);
    address public auditor2 = address(0xBB22);
    address public unauthorized = address(0xCC99);

    bytes32 public sampleBatchId = keccak256("BATCH-2026-COMPLIANCE");
    bytes32 public sampleReportHash = keccak256("AUDIT-REPORT-DIGEST-XYZ");

    event AuditorRegistered(address indexed auditor, string organizationName);
    event AuditorRevoked(address indexed auditor);

    event ComplianceAttested(
        bytes32 indexed batchId,
        address indexed auditor,
        bytes32 indexed reportHash,
        bool isCompliant,
        uint64 timestamp
    );

    function setUp() public {
        vm.prank(owner);
        verifier = new ComplianceVerifier();
    }

    // ------------------------------------------------------------------------
    // AUDITOR REGISTRATION & REVOCATION TESTS
    // ------------------------------------------------------------------------

    function test_RegisterAuditor_Success() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit AuditorRegistered(auditor1, "Deloitte Digital Asset Audit");

        verifier.registerAuditor(auditor1, "Deloitte Digital Asset Audit");

        assertTrue(verifier.isAuthorizedAuditor(auditor1));
        assertEq(verifier.getAuditorOrganization(auditor1), "Deloitte Digital Asset Audit");

        address[] memory list = verifier.getAllAuditors();
        assertEq(list.length, 1);
        assertEq(list[0], auditor1);
    }

    function test_RevokeAuditor_Success() public {
        vm.startPrank(owner);
        verifier.registerAuditor(auditor1, "KPMG Blockchain Integrity");
        assertTrue(verifier.isAuthorizedAuditor(auditor1));

        vm.expectEmit(true, false, false, false);
        emit AuditorRevoked(auditor1);
        verifier.revokeAuditor(auditor1);
        vm.stopPrank();

        assertFalse(verifier.isAuthorizedAuditor(auditor1));
    }

    function test_MultipleAuditors_Coexistence() public {
        vm.startPrank(owner);
        verifier.registerAuditor(auditor1, "Auditor One Corp");
        verifier.registerAuditor(auditor2, "Auditor Two LLC");
        vm.stopPrank();

        assertTrue(verifier.isAuthorizedAuditor(auditor1));
        assertTrue(verifier.isAuthorizedAuditor(auditor2));
        assertEq(verifier.getAuditorOrganization(auditor1), "Auditor One Corp");
        assertEq(verifier.getAuditorOrganization(auditor2), "Auditor Two LLC");

        address[] memory list = verifier.getAllAuditors();
        assertEq(list.length, 2);
    }

    // ------------------------------------------------------------------------
    // COMPLIANCE ATTESTATION TESTS
    // ------------------------------------------------------------------------

    function test_AttestCompliance_Success() public {
        vm.prank(owner);
        verifier.registerAuditor(auditor1, "PwC Web3 Advisory");

        vm.warp(1700000000);
        vm.prank(auditor1);
        vm.expectEmit(true, true, true, true);
        emit ComplianceAttested(sampleBatchId, auditor1, sampleReportHash, true, 1700000000);

        verifier.attestCompliance(sampleBatchId, sampleReportHash, true);

        IComplianceVerifier.ComplianceAttestation memory att = verifier.getAttestation(sampleBatchId, auditor1);
        assertEq(att.batchId, sampleBatchId);
        assertEq(att.auditor, auditor1);
        assertEq(att.reportHash, sampleReportHash);
        assertTrue(att.isCompliant);
        assertEq(att.verifiedAt, 1700000000);

        address[] memory batchAuditors = verifier.getBatchAuditors(sampleBatchId);
        assertEq(batchAuditors.length, 1);
        assertEq(batchAuditors[0], auditor1);
    }

    function test_MultipleAttestations_SameBatchDifferentAuditors() public {
        vm.startPrank(owner);
        verifier.registerAuditor(auditor1, "Auditor Corp 1");
        verifier.registerAuditor(auditor2, "Auditor Corp 2");
        vm.stopPrank();

        bytes32 report1 = keccak256("REPORT-1");
        bytes32 report2 = keccak256("REPORT-2");

        vm.prank(auditor1);
        verifier.attestCompliance(sampleBatchId, report1, true);

        vm.prank(auditor2);
        verifier.attestCompliance(sampleBatchId, report2, false);

        IComplianceVerifier.ComplianceAttestation memory att1 = verifier.getAttestation(sampleBatchId, auditor1);
        IComplianceVerifier.ComplianceAttestation memory att2 = verifier.getAttestation(sampleBatchId, auditor2);

        assertTrue(att1.isCompliant);
        assertFalse(att2.isCompliant);
        assertEq(att1.reportHash, report1);
        assertEq(att2.reportHash, report2);

        address[] memory auditors = verifier.getBatchAuditors(sampleBatchId);
        assertEq(auditors.length, 2);
    }

    // ------------------------------------------------------------------------
    // ACCESS CONTROL & REVERT TESTS
    // ------------------------------------------------------------------------

    function test_RevertIf_NonOwnerRegistersAuditor() public {
        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSelector(ComplianceVerifier.UnauthorizedOwner.selector, unauthorized, owner));
        verifier.registerAuditor(auditor1, "Fake Auditor");
    }

    function test_RevertIf_NonOwnerRevokesAuditor() public {
        vm.prank(owner);
        verifier.registerAuditor(auditor1, "Legit Auditor");

        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSelector(ComplianceVerifier.UnauthorizedOwner.selector, unauthorized, owner));
        verifier.revokeAuditor(auditor1);
    }

    function test_RevertIf_RegisterZeroAuditor() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ComplianceVerifier.InvalidComplianceParameters.selector, "Auditor cannot be zero address"));
        verifier.registerAuditor(address(0), "Zero Address Corp");
    }

    function test_RevertIf_RegisterEmptyOrgName() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ComplianceVerifier.InvalidComplianceParameters.selector, "Organization name cannot be empty"));
        verifier.registerAuditor(auditor1, "");
    }

    function test_RevertIf_DuplicateAuditorRegistration() public {
        vm.startPrank(owner);
        verifier.registerAuditor(auditor1, "First Registration");

        vm.expectRevert(abi.encodeWithSelector(ComplianceVerifier.AuditorAlreadyRegistered.selector, auditor1));
        verifier.registerAuditor(auditor1, "Second Registration");
        vm.stopPrank();
    }

    function test_RevertIf_RevokeNonRegisteredAuditor() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ComplianceVerifier.AuditorNotRegistered.selector, auditor1));
        verifier.revokeAuditor(auditor1);
    }

    function test_RevertIf_UnauthorizedAuditorAttests() public {
        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSelector(ComplianceVerifier.UnauthorizedAuditor.selector, unauthorized));
        verifier.attestCompliance(sampleBatchId, sampleReportHash, true);
    }

    function test_RevertIf_RevokedAuditorAttests() public {
        vm.startPrank(owner);
        verifier.registerAuditor(auditor1, "Temp Auditor");
        verifier.revokeAuditor(auditor1);
        vm.stopPrank();

        vm.prank(auditor1);
        vm.expectRevert(abi.encodeWithSelector(ComplianceVerifier.UnauthorizedAuditor.selector, auditor1));
        verifier.attestCompliance(sampleBatchId, sampleReportHash, true);
    }

    function test_RevertIf_AttestZeroBatchId() public {
        vm.prank(owner);
        verifier.registerAuditor(auditor1, "Auditor Corp");

        vm.prank(auditor1);
        vm.expectRevert(abi.encodeWithSelector(ComplianceVerifier.InvalidComplianceParameters.selector, "Batch ID cannot be zero"));
        verifier.attestCompliance(bytes32(0), sampleReportHash, true);
    }

    function test_RevertIf_AttestZeroReportHash() public {
        vm.prank(owner);
        verifier.registerAuditor(auditor1, "Auditor Corp");

        vm.prank(auditor1);
        vm.expectRevert(abi.encodeWithSelector(ComplianceVerifier.InvalidComplianceParameters.selector, "Report hash cannot be zero"));
        verifier.attestCompliance(sampleBatchId, bytes32(0), true);
    }

    function test_TransferOwnership_Success() public {
        address newOwner = address(0xAA99);
        vm.prank(owner);
        verifier.transferOwnership(newOwner);

        assertEq(verifier.owner(), newOwner);

        // New owner can now register auditors
        vm.prank(newOwner);
        verifier.registerAuditor(auditor1, "Authorized By New Owner");
        assertTrue(verifier.isAuthorizedAuditor(auditor1));
    }

    function test_RevertIf_TransferOwnershipToZero() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ComplianceVerifier.InvalidComplianceParameters.selector, "New owner cannot be zero address"));
        verifier.transferOwnership(address(0));
    }

    // ------------------------------------------------------------------------
    // FUZZ TESTS
    // ------------------------------------------------------------------------

    function testFuzz_AttestCompliance(
        bytes32 batchId,
        bytes32 reportHash,
        bool isCompliant
    ) public {
        vm.assume(batchId != bytes32(0));
        vm.assume(reportHash != bytes32(0));

        vm.prank(owner);
        verifier.registerAuditor(auditor1, "Fuzz Auditor");

        vm.prank(auditor1);
        verifier.attestCompliance(batchId, reportHash, isCompliant);

        IComplianceVerifier.ComplianceAttestation memory att = verifier.getAttestation(batchId, auditor1);
        assertEq(att.batchId, batchId);
        assertEq(att.auditor, auditor1);
        assertEq(att.reportHash, reportHash);
        assertEq(att.isCompliant, isCompliant);
    }

    function testFuzz_AuditorRegistration(address randomAuditor, string calldata orgName) public {
        vm.assume(randomAuditor != address(0));
        vm.assume(bytes(orgName).length > 0 && bytes(orgName).length < 200);

        vm.prank(owner);
        verifier.registerAuditor(randomAuditor, orgName);

        assertTrue(verifier.isAuthorizedAuditor(randomAuditor));
        assertEq(verifier.getAuditorOrganization(randomAuditor), orgName);
    }
}
