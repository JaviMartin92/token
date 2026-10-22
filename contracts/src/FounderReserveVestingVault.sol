// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title FounderReserveVestingVault
 * @notice Dedicated vesting vault for the protocol founder / owner.
 *         Releases are strictly tied to treasury reserve solvency:
 *         - Claims only allowed when Solvency Ratio > 100% (Assets > Liabilities)
 *         - Capped at maximum 10% of the reserve surplus (Assets - Liabilities) converted to ALPHA at NAV
 *         - Minimum 72-hour cooldown between successive claims
 */
contract FounderReserveVestingVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Custom Errors
    error NoReserveSurplus(uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD);
    error CooldownActive(uint256 nextAvailableTimestamp);
    error ExceedsRemainingAllocation(uint256 attempted, uint256 remaining);
    error AllocationExhausted();
    error UnauthorizedBeneficiary();

    IERC20 public immutable alphaToken;
    address public treasuryManager;
    address public beneficiary;

    uint256 public constant TOTAL_ALLOCATION = 100_000 * 1e18; // 100,000 ALPHA
    uint256 public constant COOLDOWN_PERIOD = 72 hours; // 72 hours
    uint256 public constant MAX_SURPLUS_BPS = 1000; // 10.00% (1000 / 10000)

    uint256 public totalClaimed;
    uint256 public lastClaimTimestamp;

    event AlphaClaimed(
        address indexed beneficiary,
        uint256 amountAlpha,
        uint256 surplusUSD,
        uint256 timestamp
    );
    event BeneficiaryUpdated(address indexed oldBeneficiary, address indexed newBeneficiary);
    event TreasuryManagerUpdated(address indexed oldTreasury, address indexed newTreasury);

    constructor(
        address _alphaToken,
        address _treasuryManager,
        address _beneficiary,
        address _initialAdmin
    ) {
        if (_alphaToken == address(0) || _beneficiary == address(0)) revert IProtocolErrors.ZeroAddress();

        address admin = (_initialAdmin != address(0)) ? _initialAdmin : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);

        alphaToken = IERC20(_alphaToken);
        treasuryManager = _treasuryManager;
        beneficiary = _beneficiary;
    }

    function setTreasuryManager(address _treasuryManager) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_treasuryManager == address(0)) revert IProtocolErrors.ZeroAddress();
        emit TreasuryManagerUpdated(treasuryManager, _treasuryManager);
        treasuryManager = _treasuryManager;
    }

    function setBeneficiary(address _newBeneficiary) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_newBeneficiary == address(0)) revert IProtocolErrors.ZeroAddress();
        emit BeneficiaryUpdated(beneficiary, _newBeneficiary);
        beneficiary = _newBeneficiary;
    }

    /**
     * @notice Returns the remaining locked allocation in the vault.
     */
    function remainingAllocation() public view returns (uint256) {
        if (totalClaimed >= TOTAL_ALLOCATION) return 0;
        return TOTAL_ALLOCATION - totalClaimed;
    }

    /**
     * @notice Calculates the current claimable amount of ALPHA based on treasury reserve surplus.
     * @return claimableAlpha Amount of ALPHA that can be claimed right now
     * @return surplusUSD Current reserve surplus in USD (18 decimals)
     * @return nextAvailableTimestamp Timestamp when next claim is allowed
     * @return canClaim True if all conditions (cooldown, surplus, remaining allocation) are met
     */
    function getClaimableInfo()
        public
        view
        returns (
            uint256 claimableAlpha,
            uint256 surplusUSD,
            uint256 nextAvailableTimestamp,
            bool canClaim
        )
    {
        nextAvailableTimestamp = lastClaimTimestamp + COOLDOWN_PERIOD;
        bool cooldownPassed = (block.timestamp >= nextAvailableTimestamp) || (lastClaimTimestamp == 0);

        uint256 remaining = remainingAllocation();
        if (remaining == 0 || treasuryManager == address(0)) {
            return (0, 0, nextAvailableTimestamp, false);
        }

        try ITreasury(treasuryManager).getProofOfReserves() returns (
            uint256 totalAssetsUSD,
            uint256 totalLiabilitiesUSD,
            uint256 /* collateralRatioBps */
        ) {
            if (totalAssetsUSD > totalLiabilitiesUSD) {
                surplusUSD = totalAssetsUSD - totalLiabilitiesUSD;
                uint256 maxClaimableUSD = (surplusUSD * MAX_SURPLUS_BPS) / 10000; // 10% of surplus

                uint256 navPerShare = 1e18;
                try ITreasury(treasuryManager).getNAVPerShare() returns (uint256 nav) {
                    if (nav > 0) navPerShare = nav;
                } catch {}

                uint256 alphaFromSurplus = (maxClaimableUSD * 1e18) / navPerShare;
                claimableAlpha = alphaFromSurplus > remaining ? remaining : alphaFromSurplus;
                canClaim = cooldownPassed && (claimableAlpha > 0);
            }
        } catch {
            return (0, 0, nextAvailableTimestamp, false);
        }
    }

    /**
     * @notice Claims vested ALPHA tokens strictly capped by 10% of the treasury reserve surplus.
     */
    function claimVestedAlpha() external nonReentrant returns (uint256 claimedAmount) {
        if (msg.sender != beneficiary && !hasRole(ProtocolRoles.ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedBeneficiary();
        }

        (
            uint256 claimableAlpha,
            uint256 surplusUSD,
            uint256 nextAvailableTimestamp,
            bool canClaim
        ) = getClaimableInfo();

        if (block.timestamp < nextAvailableTimestamp && lastClaimTimestamp > 0) {
            revert CooldownActive(nextAvailableTimestamp);
        }
        if (surplusUSD == 0 || claimableAlpha == 0 || !canClaim) {
            (uint256 assets, uint256 liabilities,) = ITreasury(treasuryManager).getProofOfReserves();
            revert NoReserveSurplus(assets, liabilities);
        }

        claimedAmount = claimableAlpha;
        totalClaimed += claimedAmount;
        lastClaimTimestamp = block.timestamp;

        alphaToken.safeTransfer(beneficiary, claimedAmount);

        emit AlphaClaimed(beneficiary, claimedAmount, surplusUSD, block.timestamp);
    }
}
