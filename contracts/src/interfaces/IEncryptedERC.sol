// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Groth16 zk-SNARK proof points on BN254
struct ProofPoints {
    uint256[2] a;
    uint256[2][2] b;
    uint256[2] c;
}

/// @notice Proof structure for confidential eERC transfer (32 public signals)
struct TransferProof {
    ProofPoints proofPoints;
    uint256[32] publicSignals;
}

/// @notice Proof structure for confidential eERC mint (24 public signals)
struct MintProof {
    ProofPoints proofPoints;
    uint256[24] publicSignals;
}

/// @notice Proof structure for confidential eERC withdraw (16 public signals)
struct WithdrawProof {
    ProofPoints proofPoints;
    uint256[16] publicSignals;
}

/// @notice Encrypted metadata attached to confidential operations
struct Metadata {
    address messageFrom;
    address messageTo;
    string messageType;
    bytes encryptedMsg;
}

/// @title IEncryptedERC
/// @notice Official Avalanche eERC standard interface for confidential token transfers
interface IEncryptedERC {
    // Events
    event PrivateTransfer(
        address indexed from,
        address indexed to,
        uint256[7] auditorPCT,
        address indexed auditorAddress
    );

    event PrivateMint(
        address indexed user,
        uint256[7] auditorPCT,
        address indexed auditorAddress
    );

    event PrivateBurn(
        address indexed user,
        uint256[7] auditorPCT,
        address indexed auditorAddress
    );

    event PrivateMessage(
        address indexed from,
        address indexed to,
        Metadata metadata
    );

    event AuditorChanged(
        address indexed previousAuditor,
        address indexed newAuditor
    );

    event Deposit(
        address indexed user,
        uint256 amount,
        uint256 dust,
        uint256 tokenId
    );

    event Withdraw(
        address indexed user,
        uint256 amount,
        uint256 tokenId
    );

    // Confidential Operations
    function transfer(
        address to,
        uint256 tokenId,
        TransferProof calldata proof,
        uint256[7] calldata balancePCT,
        bytes calldata message
    ) external;

    function transfer(
        address to,
        uint256 tokenId,
        TransferProof calldata proof,
        uint256[7] calldata balancePCT
    ) external;

    function privateMint(
        address user,
        MintProof calldata proof,
        bytes calldata message
    ) external;

    function withdraw(
        uint256 tokenId,
        WithdrawProof calldata proof,
        uint256[7] calldata balancePCT,
        bytes calldata message
    ) external;

    function deposit(
        uint256 amount,
        address tokenAddress,
        uint256[7] calldata amountPCT,
        bytes calldata message
    ) external;

    // Auditor & Protocol Administration
    function setAuditorPublicKey(address auditorAddress) external;
    function auditor() external view returns (address);
    function auditorPublicKey() external view returns (uint256[2] memory);
    function registrar() external view returns (address);
    function isConverter() external view returns (bool);
}
