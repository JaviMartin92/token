// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title VaultPositionNFT (vPOS)
 * @author Viraje Protocol Architecture Team
 * @notice Representa la propiedad transferible de una posición de bono vestado con descuento en el protocolo.
 * @dev Cumple con el estándar ERC-721 y AccessControl. Permite que las posiciones de inversión a plazo
 *      sean negociables en mercados secundarios o utilizadas como colateral en el mercado P2P (`P2PLendingMarket.sol`).
 */
contract VaultPositionNFT is ERC721, AccessControl {
    using SafeERC20 for IERC20;

    // =========================================================================
    // ⚠️ ERRORES PERSONALIZADOS (EIP-838)
    // =========================================================================
    error NotMinterOrAdmin();
    error NonexistentToken();
    error PositionAlreadyProcessed();

    // =========================================================================
    // 📢 EVENTOS DE DOMINIO PARA INDEXADORES (SUBGRAPHS / ARBISCAN)
    // =========================================================================
    event PositionMinted(
        uint256 indexed tokenId,
        address indexed owner,
        address underlyingAsset,
        uint256 principalAmount,
        uint256 discountedPricePaid,
        uint256 lockYears,
        uint64 expirationTimestamp
    );
    event PositionRagequitted(uint256 indexed tokenId, address indexed caller);
    event PositionClaimed(uint256 indexed tokenId, address indexed caller);
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    // =========================================================================
    // 📦 ESTRUCTURA DE DATOS DE LA POSICIÓN (OPTIMIZADA EN SLOTS DE 32 BYTES)
    // =========================================================================
    struct Position {
        uint256 id;                   // Slot 0: 32 bytes
        address underlyingAsset;      // Slot 1: 20 bytes
        uint64 depositTimestamp;      // Slot 1: 8 bytes
        uint32 lockYears;             // Slot 1: 4 bytes (20 + 8 + 4 = 32 bytes)
        uint64 expirationTimestamp;   // Slot 2: 8 bytes
        bool isRagequitted;           // Slot 2: 1 byte
        bool isMaturedClaimed;        // Slot 2: 1 byte
        uint256 principalAmount;      // Slot 3: 32 bytes
        uint256 discountedPricePaid;  // Slot 4: 32 bytes
    }

    /// @notice Contador incremental determinista de IDs de token.
    uint256 public nextTokenId = 1;

    /// @notice Dirección autorizada para emitir y gestionar bonos (`VestedDiscountVault.sol`).
    address public minter;

    /// @notice Mapeo de ID de token a la estructura de posición histórica on-chain.
    mapping(uint256 => Position) public positions;

    // =========================================================================
    // 🔒 MODIFICADORES DE CONTROL DE ACCESO
    // =========================================================================
    modifier onlyMinter() {
        if (
            msg.sender != minter &&
            !hasRole(ProtocolRoles.MINTER_ROLE, msg.sender) &&
            !hasRole(ProtocolRoles.ADMIN_ROLE, msg.sender)
        ) {
            revert NotMinterOrAdmin();
        }
        _;
    }

    /**
     * @notice Constructor del contrato de bonos NFT.
     * @param _initialOwner Dirección que recibe la administración inicial del contrato.
     */
    constructor(address _initialOwner) ERC721("Vested Position NFT", "vPOS") {
        if (_initialOwner == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);
    }

    /**
     * @notice Asigna o actualiza el contrato minter autorizado (`VestedDiscountVault.sol`).
     * @param _minter Dirección del nuevo contrato minter.
     */
    function setMinter(address _minter) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_minter == address(0)) revert IProtocolErrors.ZeroAddress();
        address oldMinter = minter;
        minter = _minter;
        emit MinterUpdated(oldMinter, _minter);
    }

    /**
     * @notice Acuña un nuevo NFT representativo de una posición de bono vestado.
     * @param to Dirección del inversor receptor del NFT.
     * @param underlyingAsset Activo de tesorería depositado (ej. USDC).
     * @param principalAmount Valor nominal principal del bono al vencimiento.
     * @param discountedPricePaid Precio neto con descuento pagado por el inversor.
     * @param lockYears Duración del bloqueo en años (1 a 5 años).
     * @return tokenId Identificador único asignado al NFT emitido.
     */
    function mintPosition(
        address to,
        address underlyingAsset,
        uint256 principalAmount,
        uint256 discountedPricePaid,
        uint256 lockYears
    ) external onlyMinter returns (uint256 tokenId) {
        tokenId = nextTokenId;
        unchecked {
            ++nextTokenId;
        }

        uint64 expTime = uint64(block.timestamp + (lockYears * 365 days));

        positions[tokenId] = Position({
            id: tokenId,
            underlyingAsset: underlyingAsset,
            depositTimestamp: uint64(block.timestamp),
            lockYears: uint32(lockYears),
            expirationTimestamp: expTime,
            isRagequitted: false,
            isMaturedClaimed: false,
            principalAmount: principalAmount,
            discountedPricePaid: discountedPricePaid
        });

        _mint(to, tokenId);

        emit PositionMinted(
            tokenId,
            to,
            underlyingAsset,
            principalAmount,
            discountedPricePaid,
            lockYears,
            expTime
        );
    }

    /**
     * @notice Registra el rescate anticipado de emergencia (Ragequit) sobre la posición.
     * @param tokenId Identificador de la posición.
     */
    function markRagequitted(uint256 tokenId) external onlyMinter {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentToken();
        if (positions[tokenId].isRagequitted || positions[tokenId].isMaturedClaimed) {
            revert PositionAlreadyProcessed();
        }
        positions[tokenId].isRagequitted = true;
        emit PositionRagequitted(tokenId, msg.sender);
    }

    /**
     * @notice Registra el cobro completo del principal al vencimiento.
     * @param tokenId Identificador de la posición.
     */
    function markClaimed(uint256 tokenId) external onlyMinter {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentToken();
        if (positions[tokenId].isRagequitted || positions[tokenId].isMaturedClaimed) {
            revert PositionAlreadyProcessed();
        }
        positions[tokenId].isMaturedClaimed = true;
        emit PositionClaimed(tokenId, msg.sender);
    }

    /**
     * @notice Quema el token NFT preservando el registro contable e histórico de la posición.
     * @param tokenId Identificador del token a quemar.
     */
    function burn(uint256 tokenId) external onlyMinter {
        _burn(tokenId);
    }

    /**
     * @notice Consulta los metadatos completos y estado de una posición de bono.
     * @param tokenId Identificador de la posición.
     * @return Estructura Position con los detalles contables y temporales.
     */
    function getPosition(uint256 tokenId) external view returns (Position memory) {
        if (tokenId == 0 || tokenId >= nextTokenId) revert NonexistentToken();
        return positions[tokenId];
    }

    /**
     * @notice Rescata tokens ERC-20 transferidos accidentalmente a este contrato.
     * @dev Restringido a `ADMIN_ROLE` (TimelockController con 72h de retardo).
     * @param token Dirección del token a rescatar.
     * @param to Dirección de destino donde se transferirán los tokens rescatados.
     */
    function sweepTokens(address token, address to) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert IProtocolErrors.InvalidAmount();

        IERC20(token).safeTransfer(to, bal);
        emit TokensSwept(token, to, bal);
    }

    /**
     * @notice Comprobación de interfaces compatibles conforme a EIP-165.
     * @param interfaceId Identificador de la interfaz consultada.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return
            interfaceId == 0x80ac58cd || // ERC-721 Interface ID
            interfaceId == 0x5b5e139f || // ERC-721 Metadata Interface ID
            interfaceId == 0x7965db0b || // AccessControl Interface ID
            interfaceId == 0x01ffc9a7;   // ERC-165 Interface ID
    }
}
