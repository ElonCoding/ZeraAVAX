// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IComplianceVerifier.sol";

/// @title ComplianceVerifier
/// @notice Manages authorized compliance auditors and records on-chain attestations
///         for audited confidential payroll batches on Avalanche L1.
contract ComplianceVerifier is IComplianceVerifier {
    // Custom Errors
    error UnauthorizedOwner(address caller, address owner);
    error AuditorAlreadyRegistered(address auditor);
    error AuditorNotRegistered(address auditor);
    error UnauthorizedAuditor(address caller);
    error InvalidComplianceParameters(string reason);

    // State Variables
    address public owner;
    mapping(address => bool) private _authorizedAuditors;
    mapping(address => string) private _auditorOrganizations;
    address[] private _auditorList;

    // batchId => auditor => ComplianceAttestation
    mapping(bytes32 => mapping(address => ComplianceAttestation)) private _attestations;
    mapping(bytes32 => address[]) private _batchAuditors;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert UnauthorizedOwner(msg.sender, owner);
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Transfers ownership of the verifier registry to a new address
    /// @param newOwner Address of the new contract owner
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert InvalidComplianceParameters("New owner cannot be zero address");
        }
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Authorizes a compliance auditor organization
    /// @param auditor Wallet address of the auditor
    /// @param organizationName Official legal name of the audit entity
    function registerAuditor(
        address auditor,
        string calldata organizationName
    ) external override onlyOwner {
        if (auditor == address(0)) {
            revert InvalidComplianceParameters("Auditor cannot be zero address");
        }
        if (bytes(organizationName).length == 0) {
            revert InvalidComplianceParameters("Organization name cannot be empty");
        }
        if (_authorizedAuditors[auditor]) {
            revert AuditorAlreadyRegistered(auditor);
        }

        emit AuditorRegistered(auditor, organizationName);
        // forge-lint: disable-next-line(missing-events-access-control)
        _authorizedAuditors[auditor] = true;
        _auditorOrganizations[auditor] = organizationName;
        _auditorList.push(auditor);
    }

    /// @notice Revokes compliance auditing privileges from an address
    /// @param auditor Address of the auditor to revoke
    function revokeAuditor(address auditor) external override onlyOwner {
        if (!_authorizedAuditors[auditor]) {
            revert AuditorNotRegistered(auditor);
        }

        emit AuditorRevoked(auditor);
        // forge-lint: disable-next-line(missing-events-access-control)
        _authorizedAuditors[auditor] = false;
    }

    /// @notice Posts an immutable compliance attestation for a payroll batch
    /// @param batchId The batch identifier being attested
    /// @param reportHash Cryptographic digest of the off-chain compliance report
    /// @param isCompliant Boolean indicating whether the payroll batch meets compliance standards
    function attestCompliance(
        bytes32 batchId,
        bytes32 reportHash,
        bool isCompliant
    ) external override {
        if (!_authorizedAuditors[msg.sender]) {
            revert UnauthorizedAuditor(msg.sender);
        }
        if (batchId == bytes32(0)) {
            revert InvalidComplianceParameters("Batch ID cannot be zero");
        }
        if (reportHash == bytes32(0)) {
            revert InvalidComplianceParameters("Report hash cannot be zero");
        }

        ComplianceAttestation storage attestation = _attestations[batchId][msg.sender];
        bool isFirstAttestation = (attestation.verifiedAt == 0);

        attestation.batchId = batchId;
        attestation.auditor = msg.sender;
        attestation.reportHash = reportHash;
        // casting to uint64 is safe because block.timestamp will not exceed 2^64-1
        // forge-lint: disable-next-line(unsafe-typecast)
        attestation.verifiedAt = uint64(block.timestamp);
        attestation.isCompliant = isCompliant;

        if (isFirstAttestation) {
            _batchAuditors[batchId].push(msg.sender);
        }

        emit ComplianceAttested(
            batchId,
            msg.sender,
            reportHash,
            isCompliant,
            attestation.verifiedAt
        );
    }

    /// @notice Retrieves a specific auditor's attestation for a batch
    /// @param batchId The batch identifier
    /// @param auditor The auditor address
    function getAttestation(
        bytes32 batchId,
        address auditor
    ) external view override returns (ComplianceAttestation memory) {
        return _attestations[batchId][auditor];
    }

    /// @notice Checks if an address is currently an authorized auditor
    /// @param account Address to query
    function isAuthorizedAuditor(address account) external view override returns (bool) {
        return _authorizedAuditors[account];
    }

    /// @notice Gets organization name of an auditor
    /// @param auditor Address of the auditor
    function getAuditorOrganization(address auditor) external view returns (string memory) {
        return _auditorOrganizations[auditor];
    }

    /// @notice Gets all auditors that have attested a specific batch
    /// @param batchId The batch identifier
    function getBatchAuditors(bytes32 batchId) external view returns (address[] memory) {
        return _batchAuditors[batchId];
    }

    /// @notice Returns list of all registered auditors
    function getAllAuditors() external view returns (address[] memory) {
        return _auditorList;
    }
}
