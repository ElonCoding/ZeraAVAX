// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IEncryptedERC.sol";

/// @notice Proof structure for user registration (5 public signals)
struct RegisterProof {
    ProofPoints proofPoints;
    uint256[5] publicSignals;
}

/// @title IRegistrar
/// @notice Registry interface storing BabyJub public keys for eERC participants and auditors
interface IRegistrar {
    event Register(address indexed user, uint256[2] publicKey);

    function register(RegisterProof calldata proof) external;
    function getUserPublicKey(address user) external view returns (uint256[2] memory);
    function isUserRegistered(address user) external view returns (bool);
    function userPublicKeys(address user) external view returns (uint256 x, uint256 y);
}
