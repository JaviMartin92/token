// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MockERC20.sol";
import "../TreasuryManager.sol";

/**
 * @title TestnetFaucet
 * @notice A public faucet for testnet testing of the Alpha Centauri protocol.
 * @dev Mints mock USDC and automatically grants KYC whitelist status on the TreasuryManager.
 *      WARNING: MUST NEVER BE DEPLOYED TO MAINNET.
 */
contract TestnetFaucet {
    MockERC20 public usdc;
    TreasuryManager public treasury;

    uint256 public constant DRIP_AMOUNT = 10_000 * 1e6; // 10k USDC
    mapping(address => uint256) public lastRequestTime;
    uint256 public constant COOLDOWN = 24 hours;

    event FaucetTriggered(address indexed user, uint256 amount);

    constructor(address _usdc, address _treasury) {
        usdc = MockERC20(_usdc);
        treasury = TreasuryManager(payable(_treasury));
    }

    /**
     * @notice Allows users to request testnet USDC and automatically receive KYC status.
     * @dev The Faucet contract must have the COMPLIANCE_ROLE in the TreasuryManager.
     */
    function requestTokens() external {
        require(block.timestamp >= lastRequestTime[msg.sender] + COOLDOWN, "TestnetFaucet: Please wait 24h between requests");
        
        // Update cooldown
        lastRequestTime[msg.sender] = block.timestamp;

        // 1. Grant KYC to user if not already granted
        if (!treasury.kycWhitelist(msg.sender)) {
            treasury.setKYCStatus(msg.sender, true);
        }

        // 2. Mint Mock USDC
        usdc.mint(msg.sender, DRIP_AMOUNT);

        emit FaucetTriggered(msg.sender, DRIP_AMOUNT);
    }
}
