// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/PrivatePayroll.sol";
import "../src/ComplianceVerifier.sol";
import "../src/mock/MockRegistrar.sol";
import "../src/mock/MockEncryptedERC.sol";

/// @title Deploy
/// @notice Foundry deployment script for CashLayer Private Payroll on Avalanche L1 / Fuji / Anvil
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );

        address auditorAddress = vm.envOr(
            "AUDITOR_ADDRESS",
            address(0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65)
        );

        string memory auditorOrg = vm.envOr(
            "AUDITOR_ORGANIZATION",
            string("Avalanche Financial Compliance Authority")
        );

        address existingRegistrar = vm.envOr("REGISTRAR_ADDRESS", address(0));
        address existingEerc = vm.envOr("ENCRYPTED_ERC_ADDRESS", address(0));

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy or resolve Registrar
        address registrarAddr;
        if (existingRegistrar != address(0)) {
            registrarAddr = existingRegistrar;
            console2.log("Using existing Registrar at:", registrarAddr);
        } else {
            MockRegistrar registrar = new MockRegistrar();
            registrarAddr = address(registrar);
            console2.log("Deployed MockRegistrar at:", registrarAddr);
        }

        // 2. Deploy or resolve EncryptedERC
        address eercAddr;
        if (existingEerc != address(0)) {
            eercAddr = existingEerc;
            console2.log("Using existing EncryptedERC at:", eercAddr);
        } else {
            MockEncryptedERC eerc = new MockEncryptedERC(registrarAddr);
            eercAddr = address(eerc);
            console2.log("Deployed MockEncryptedERC at:", eercAddr);

            if (auditorAddress != address(0)) {
                eerc.setAuditorPublicKey(auditorAddress);
                console2.log("Configured token auditor:", auditorAddress);
            }
        }

        // 3. Deploy ComplianceVerifier
        ComplianceVerifier verifier = new ComplianceVerifier();
        console2.log("Deployed ComplianceVerifier at:", address(verifier));

        if (auditorAddress != address(0)) {
            verifier.registerAuditor(auditorAddress, auditorOrg);
            console2.log("Registered auditor in ComplianceVerifier:", auditorAddress);
        }

        // 4. Deploy PrivatePayroll Coordinator
        PrivatePayroll payroll = new PrivatePayroll();
        console2.log("Deployed PrivatePayroll at:", address(payroll));

        vm.stopBroadcast();

        console2.log("=== Deployment Summary ===");
        console2.log("Registrar:           ", registrarAddr);
        console2.log("EncryptedERC:        ", eercAddr);
        console2.log("ComplianceVerifier:  ", address(verifier));
        console2.log("PrivatePayroll:      ", address(payroll));
    }
}
