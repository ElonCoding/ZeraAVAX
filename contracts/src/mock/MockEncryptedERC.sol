// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IEncryptedERC.sol";
import "../interfaces/IRegistrar.sol";

/// @title MockEncryptedERC
/// @notice Faithful mock simulation of the Avalanche eERC token contract
///         providing private transfers, encrypted balance tracking, and auditorPCT emission.
contract MockEncryptedERC is IEncryptedERC {
    address public override registrar;
    address public override auditor;
    uint256[2] private _auditorPublicKey;

    // Encrypted balances: address => [c1.x, c1.y, c2.x, c2.y]
    mapping(address => uint256[4]) public encryptedBalances;
    // Internal simulated balances for deterministic verification
    mapping(address => uint256) public simulatedBalances;

    constructor(address registrarAddress) {
        require(registrarAddress != address(0), "Invalid registrar");
        registrar = registrarAddress;
    }

    /// @notice Configures the active auditor and fetches public key from Registrar
    /// @param auditorAddress The auditor address
    function setAuditorPublicKey(address auditorAddress) external override {
        require(auditorAddress != address(0), "Invalid auditor address");
        address prev = auditor;
        auditor = auditorAddress;

        if (registrar != address(0)) {
            _auditorPublicKey = IRegistrar(registrar).getUserPublicKey(auditorAddress);
        }

        emit AuditorChanged(prev, auditorAddress);
    }

    /// @notice Sets auditor public key directly (test helper)
    function setAuditorDirect(address auditorAddress, uint256[2] calldata pubKey) external {
        require(auditorAddress != address(0), "Invalid auditor address");
        address prev = auditor;
        auditor = auditorAddress;
        _auditorPublicKey = pubKey;
        emit AuditorChanged(prev, auditorAddress);
    }

    function auditorPublicKey() external view override returns (uint256[2] memory) {
        return _auditorPublicKey;
    }

    function isConverter() external pure override returns (bool) {
        return false;
    }

    /// @notice Executes confidential transfer with encrypted metadata
    function transfer(
        address to,
        uint256 /* tokenId */,
        TransferProof calldata proof,
        uint256[7] calldata /* balancePCT */,
        bytes calldata message
    ) external override {
        require(to != address(0), "Invalid recipient");

        // Extract auditorPCT from proof public signals (indices 18..24)
        uint256[7] memory auditorPCT;
        for (uint256 i = 0; i < 7; i++) {
            auditorPCT[i] = proof.publicSignals[18 + i];
        }

        // Emit standard eERC PrivateTransfer event
        emit PrivateTransfer(msg.sender, to, auditorPCT, auditor);

        if (message.length > 0) {
            emit PrivateMessage(
                msg.sender,
                to,
                Metadata({
                    messageFrom: msg.sender,
                    messageTo: to,
                    messageType: "PAYROLL_TRANSFER",
                    encryptedMsg: message
                })
            );
        }
    }

    /// @notice Overloaded transfer without message
    function transfer(
        address to,
        uint256 /* tokenId */,
        TransferProof calldata proof,
        uint256[7] calldata /* balancePCT */
    ) external override {
        require(to != address(0), "Invalid recipient");

        uint256[7] memory auditorPCT;
        for (uint256 i = 0; i < 7; i++) {
            auditorPCT[i] = proof.publicSignals[18 + i];
        }

        emit PrivateTransfer(msg.sender, to, auditorPCT, auditor);
    }

    /// @notice Confidential mint
    function privateMint(
        address user,
        MintProof calldata proof,
        bytes calldata /* message */
    ) external override {
        require(user != address(0), "Invalid user");

        uint256[7] memory auditorPCT;
        for (uint256 i = 0; i < 7; i++) {
            auditorPCT[i] = proof.publicSignals[12 + i];
        }

        emit PrivateMint(user, auditorPCT, auditor);
    }

    /// @notice Confidential deposit
    function deposit(
        uint256 amount,
        address /* tokenAddress */,
        uint256[7] calldata /* amountPCT */,
        bytes calldata /* message */
    ) external override {
        emit Deposit(msg.sender, amount, 0, 0);
    }

    /// @notice Confidential withdraw
    function withdraw(
        uint256 tokenId,
        WithdrawProof calldata proof,
        uint256[7] calldata /* balancePCT */,
        bytes calldata /* message */
    ) external override {
        uint256 amount = proof.publicSignals[0];
        emit Withdraw(msg.sender, amount, tokenId);
    }

    /// @notice Set simulated balance for test assertions
    function setSimulatedBalance(address user, uint256 balance) external {
        simulatedBalances[user] = balance;
    }

    /// @notice Set encrypted balance ciphertext for test assertions
    function setEncryptedBalance(address user, uint256[4] calldata ciphertext) external {
        encryptedBalances[user] = ciphertext;
    }
}
