// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IRegistrar.sol";

/// @title MockRegistrar
/// @notice Faithful mock implementation of the eERC Registrar storing BabyJub public keys
contract MockRegistrar is IRegistrar {
    mapping(address => uint256[2]) private _publicKeys;
    mapping(address => bool) private _isRegistered;
    address[] private _registeredUsers;

    /// @notice Register user public key using a Groth16 RegisterProof
    function register(RegisterProof calldata proof) external override {
        // In the register.circom circuit, publicSignals include [userAddress, pubKeyX, pubKeyY, ...]
        uint256[2] memory pubKey = [proof.publicSignals[1], proof.publicSignals[2]];
        _publicKeys[msg.sender] = pubKey;
        _isRegistered[msg.sender] = true;
        _registeredUsers.push(msg.sender);

        emit Register(msg.sender, pubKey);
    }

    /// @notice Deterministic registration helper for test harnesses and mock deployments
    function registerPublicKey(address user, uint256[2] calldata pubKey) external {
        _publicKeys[user] = pubKey;
        _isRegistered[user] = true;
        _registeredUsers.push(user);

        emit Register(user, pubKey);
    }

    function getUserPublicKey(address user) external view override returns (uint256[2] memory) {
        return _publicKeys[user];
    }

    function isUserRegistered(address user) external view override returns (bool) {
        return _isRegistered[user];
    }

    function userPublicKeys(address user) external view override returns (uint256 x, uint256 y) {
        return (_publicKeys[user][0], _publicKeys[user][1]);
    }

    function totalRegisteredUsers() external view returns (uint256) {
        return _registeredUsers.length;
    }
}
