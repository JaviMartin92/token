// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PostQuantumGuard.sol";
import "../src/ProtocolAddressProvider.sol";

contract PostQuantumGuardTest is Test {
    PostQuantumGuard public guard;
    ProtocolAddressProvider public addressProvider;

    address public admin = address(0xAD);
    address public alice = address(0xA11CE);

    // Semillas privadas simuladas de Alice para las 67 cadenas
    bytes32[67] private privateKeys;
    bytes32[67] private publicKeys;
    bytes32 public aliceCommitmentRoot;

    function setUp() public {
        vm.startPrank(admin);
        addressProvider = new ProtocolAddressProvider(admin);
        guard = new PostQuantumGuard(admin, address(addressProvider));
        guard.grantRole(guard.QUANTUM_OPERATOR_ROLE(), alice);
        vm.stopPrank();

        // Generar par de claves W-OTS+ deterministas para Alice
        for (uint256 i = 0; i < 67; i++) {
            privateKeys[i] = keccak256(abi.encodePacked("alice_quantum_seed_", i));
            
            // La clave pública es hash^15(clave_privada)
            bytes32 pk = privateKeys[i];
            for (uint256 step = 0; step < 15; step++) {
                pk = keccak256(abi.encodePacked(pk));
            }
            publicKeys[i] = pk;
        }

        aliceCommitmentRoot = keccak256(abi.encode(publicKeys));

        vm.prank(alice);
        guard.registerQuantumCommitment(aliceCommitmentRoot);
    }

    // Helper para firmar un mensaje según W-OTS+ (w=4, 67 cadenas)
    function _signMessage(bytes32 messageHash, bytes32[67] memory privKeys)
        internal
        pure
        returns (bytes32[67] memory sig)
    {
        uint256 sumNibbles = 0;

        for (uint256 i = 0; i < 32; i++) {
            uint8 byteVal = uint8(messageHash[i]);
            uint8 n0 = byteVal >> 4;
            uint8 n1 = byteVal & 0x0F;

            sumNibbles += (n0 + n1);

            bytes32 s0 = privKeys[i * 2];
            for (uint256 step = 0; step < n0; step++) {
                s0 = keccak256(abi.encodePacked(s0));
            }
            sig[i * 2] = s0;

            bytes32 s1 = privKeys[i * 2 + 1];
            for (uint256 step = 0; step < n1; step++) {
                s1 = keccak256(abi.encodePacked(s1));
            }
            sig[i * 2 + 1] = s1;
        }

        uint256 checksum = 960 - sumNibbles;
        uint8 c0 = uint8((checksum >> 8) & 0x0F);
        uint8 c1 = uint8((checksum >> 4) & 0x0F);
        uint8 c2 = uint8(checksum & 0x0F);

        bytes32 sc0 = privKeys[64];
        for (uint256 step = 0; step < c0; step++) {
            sc0 = keccak256(abi.encodePacked(sc0));
        }
        sig[64] = sc0;

        bytes32 sc1 = privKeys[65];
        for (uint256 step = 0; step < c1; step++) {
            sc1 = keccak256(abi.encodePacked(sc1));
        }
        sig[65] = sc1;

        bytes32 sc2 = privKeys[66];
        for (uint256 step = 0; step < c2; step++) {
            sc2 = keccak256(abi.encodePacked(sc2));
        }
        sig[66] = sc2;
    }

    function test_InitialQuantumCommitmentRegistration() public view {
        assertEq(guard.getActiveCommitment(alice), aliceCommitmentRoot);
        assertFalse(guard.usedCommitments(aliceCommitmentRoot));
    }

    function test_VerifyValidWinternitzSignature() public view {
        bytes32 message = keccak256("execute_emergency_freeze_payload");
        bytes32[67] memory sig = _signMessage(message, privateKeys);

        bool valid = guard.verifyWinternitzSignature(message, sig, aliceCommitmentRoot);
        assertTrue(valid, "La firma post-cuantica W-OTS+ deberia ser valida");
    }

    function test_RevertIf_TamperedMessage() public view {
        bytes32 messageOriginal = keccak256("valid_proposal_100");
        bytes32 messageTampered = keccak256("tampered_proposal_666");
        bytes32[67] memory sig = _signMessage(messageOriginal, privateKeys);

        bool valid = guard.verifyWinternitzSignature(messageTampered, sig, aliceCommitmentRoot);
        assertFalse(valid, "La firma sobre un mensaje manipulado debe ser invalida");
    }

    function test_AuthorizeAction_And_PreventReplay() public {
        bytes32 actionId = keccak256("action_transfer_rescue_001");
        bytes32 message = keccak256(abi.encodePacked(block.chainid, address(guard), alice, actionId));
        bytes32[67] memory sig = _signMessage(message, privateKeys);

        bytes32 nextRoot = keccak256("next_quantum_root_key");

        vm.prank(alice);
        bool ok = guard.authorizeGuardedAction(actionId, message, sig, nextRoot);
        assertTrue(ok);
        assertTrue(guard.isActionQuantumAuthorized(actionId));
        assertTrue(guard.usedCommitments(aliceCommitmentRoot));
        assertEq(guard.getActiveCommitment(alice), nextRoot);

        // Intento de re-utilización debe revertir (Replay Protection)
        vm.prank(alice);
        vm.expectRevert(PostQuantumGuard.QuantumCommitmentAlreadyUsed.selector);
        guard.registerQuantumCommitment(aliceCommitmentRoot);
    }

    function testFuzz_VerifySignature(bytes32 randomMsg) public view {
        bytes32[67] memory sig = _signMessage(randomMsg, privateKeys);
        bool valid = guard.verifyWinternitzSignature(randomMsg, sig, aliceCommitmentRoot);
        assertTrue(valid, "Fuzzing W-OTS+: Todo digest arbitrario debe ser verificable correctamente");
    }
}
