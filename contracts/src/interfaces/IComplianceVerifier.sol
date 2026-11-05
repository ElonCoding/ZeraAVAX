// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IComplianceVerifier
/// @notice Auditor authorization registry and compliance attestation interface
interface IComplianceVerifier {
    struct ComplianceAttestation {
        bytes32 batchId;
        address auditor;
        bytes32 reportHash;
        uint64 verifiedAt;
        bool isCompliant;
    }

    event AuditorRegistered(address indexed auditor, string organizationName);
    event AuditorRevoked(address indexed auditor);

    event ComplianceAttested(
        bytes32 indexed batchId,
        address indexed auditor,
        bytes32 indexed reportHash,
        bool isCompliant,
        uint64 timestamp
    );

    function registerAuditor(address auditor, string calldata organizationName) external;
    function revokeAuditor(address auditor) external;
    function attestCompliance(
        bytes32 batchId,
        bytes32 reportHash,
        bool isCompliant
    ) external;

    function getAttestation(bytes32 batchId, address auditor) external view returns (ComplianceAttestation memory);
    function isAuthorizedAuditor(address account) external view returns (bool);
}
