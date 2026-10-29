// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title ProtocolAddressProvider
 * @author Alpha Centauri Architecture Team
 * @notice Registro central y Service Locator inmutable para la resolución dinámica de contratos del protocolo.
 * @dev Permite la actualización modular y desacoplada de subsistemas (oráculos, enrutadores de rendimiento,
 *      motores de buyback) sin requerir migraciones complejas de almacenamiento.
 *      En producción (Pure DeFi), el rol `DEFAULT_ADMIN_ROLE` está cedido irreversiblemente al `TimelockController.sol`.
 */
contract ProtocolAddressProvider is AccessControl {
    // =========================================================================
    // 🏷️ IDENTIFICADORES DE MÓDULOS DEL PROTOCOLO
    // =========================================================================
    bytes32 public constant ID_TREASURY_MANAGER = keccak256("TREASURY_MANAGER");
    bytes32 public constant ID_ALPHA_VAULT = keccak256("ALPHA_VAULT");
    bytes32 public constant ID_ALPHA_TOKEN = keccak256("ALPHA_TOKEN");
    bytes32 public constant ID_ORACLE_HUB = keccak256("ORACLE_HUB");
    bytes32 public constant ID_TOKENOMICS_ENGINE = keccak256("TOKENOMICS_ENGINE");
    bytes32 public constant ID_GOVERNANCE_STAKING = keccak256("GOVERNANCE_STAKING");
    bytes32 public constant ID_REAL_YIELD_ROUTER = keccak256("REAL_YIELD_ROUTER");
    bytes32 public constant ID_P2P_MARKET = keccak256("P2P_MARKET");
    bytes32 public constant ID_VESTED_VAULT = keccak256("VESTED_VAULT");
    bytes32 public constant ID_COMMUNITY_YIELD_VAULT = keccak256("COMMUNITY_YIELD_VAULT");
    bytes32 public constant ID_MORPHO_ADAPTER = keccak256("MORPHO_ADAPTER");
    bytes32 public constant ID_DISCOUNT_BUYBACK_ENGINE = keccak256("DISCOUNT_BUYBACK_ENGINE");
    bytes32 public constant ID_FOUNDER_VESTING_VAULT = keccak256("FOUNDER_VESTING_VAULT");
    bytes32 public constant ID_POST_QUANTUM_GUARD = keccak256("POST_QUANTUM_GUARD");
    bytes32 public constant ID_CIRCUIT_BREAKER = keccak256("CIRCUIT_BREAKER");
    bytes32 public constant ID_GOVERNOR = keccak256("GOVERNOR");
    bytes32 public constant ID_TIMELOCK = keccak256("TIMELOCK");

    // =========================================================================
    // 📦 ALMACENAMIENTO & EVENTOS
    // =========================================================================
    mapping(bytes32 => address) private _addresses;

    event AddressUpdated(bytes32 indexed id, address indexed oldAddress, address indexed newAddress);

    /**
     * @notice Constructor que asigna el administrador inicial del registro.
     * @param initialAdmin Dirección que recibe el control de administración génesis.
     */
    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Registra o actualiza la dirección de un módulo específico.
     * @param id Identificador bytes32 del componente (ej. ID_TREASURY_MANAGER).
     * @param newAddress Nueva dirección del contrato correspondiente.
     */
    function setAddress(bytes32 id, address newAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newAddress == address(0)) revert IProtocolErrors.ZeroAddress();
        address oldAddress = _addresses[id];
        _addresses[id] = newAddress;
        emit AddressUpdated(id, oldAddress, newAddress);
    }

    /**
     * @notice Registra múltiples componentes en una sola transacción atómica para gobernanza o despliegue.
     * @param ids Lista de identificadores bytes32.
     * @param newAddresses Lista de direcciones ordenadas correspondientes a cada ID.
     */
    function setAddressBatch(bytes32[] calldata ids, address[] calldata newAddresses) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 len = ids.length;
        if (len != newAddresses.length || len == 0) {
            revert IProtocolErrors.InvalidParameters();
        }
        for (uint256 i = 0; i < len;) {
            address target = newAddresses[i];
            if (target == address(0)) revert IProtocolErrors.ZeroAddress();
            bytes32 currentId = ids[i];
            address oldAddress = _addresses[currentId];
            _addresses[currentId] = target;
            emit AddressUpdated(currentId, oldAddress, target);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Obtiene la dirección registrada para un identificador determinado.
     * @param id Identificador bytes32 a consultar.
     * @return Dirección del contrato registrado o address(0) si no ha sido configurado.
     */
    function getAddress(bytes32 id) public view returns (address) {
        return _addresses[id];
    }

    // =========================================================================
    // 🔍 GETTERS DE CONVENIENCIA
    // =========================================================================
    function getTreasuryManager() external view returns (address) {
        return getAddress(ID_TREASURY_MANAGER);
    }

    function getAlphaVault() external view returns (address) {
        return getAddress(ID_ALPHA_VAULT);
    }

    function getAlphaToken() external view returns (address) {
        return getAddress(ID_ALPHA_TOKEN);
    }

    function getOracleHub() external view returns (address) {
        return getAddress(ID_ORACLE_HUB);
    }

    function getTokenomicsEngine() external view returns (address) {
        return getAddress(ID_TOKENOMICS_ENGINE);
    }

    function getGovernanceStaking() external view returns (address) {
        return getAddress(ID_GOVERNANCE_STAKING);
    }

    function getRealYieldRouter() external view returns (address) {
        return getAddress(ID_REAL_YIELD_ROUTER);
    }

    function getP2PMarket() external view returns (address) {
        return getAddress(ID_P2P_MARKET);
    }

    function getVestedVault() external view returns (address) {
        return getAddress(ID_VESTED_VAULT);
    }

    function getCommunityYieldVault() external view returns (address) {
        return getAddress(ID_COMMUNITY_YIELD_VAULT);
    }

    function getMorphoAdapter() external view returns (address) {
        return getAddress(ID_MORPHO_ADAPTER);
    }

    function getDiscountBuybackEngine() external view returns (address) {
        return getAddress(ID_DISCOUNT_BUYBACK_ENGINE);
    }

    function getFounderVestingVault() external view returns (address) {
        return getAddress(ID_FOUNDER_VESTING_VAULT);
    }

    function getPostQuantumGuard() external view returns (address) {
        return getAddress(ID_POST_QUANTUM_GUARD);
    }

    function getCircuitBreaker() external view returns (address) {
        return getAddress(ID_CIRCUIT_BREAKER);
    }

    function getGovernor() external view returns (address) {
        return getAddress(ID_GOVERNOR);
    }

    function getTimelock() external view returns (address) {
        return getAddress(ID_TIMELOCK);
    }
}
