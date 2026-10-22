import { decodeErrorResult } from 'viem';

// Custom Solidity Errors definitions aggregated across Alpha Centauri smart contracts
const PROTOCOL_CUSTOM_ERRORS_ABI = [
  // General & Auth
  { type: 'error', name: 'Unauthorized', inputs: [] },
  { type: 'error', name: 'OnlyGovernance', inputs: [] },
  { type: 'error', name: 'ContractPaused', inputs: [] },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'InvalidAmount', inputs: [] },
  { type: 'error', name: 'TransferFailed', inputs: [] },

  // Treasury & Reserves
  { type: 'error', name: 'InsufficientLiquidity', inputs: [] },
  { type: 'error', name: 'ExcessiveSlippage', inputs: [] },
  { type: 'error', name: 'SameBlockDepositRedeemCooldown', inputs: [] },
  { type: 'error', name: 'SanityBoundsExceeded', inputs: [] },
  { type: 'error', name: 'KYCRequired', inputs: [] },
  { type: 'error', name: 'BreakerActive', inputs: [] },
  { type: 'error', name: 'OracleStale', inputs: [] },
  { type: 'error', name: 'PriceDeviationTooHigh', inputs: [] },

  // Staking & Yield
  { type: 'error', name: 'NoYieldToClaim', inputs: [] },
  { type: 'error', name: 'StakeLocked', inputs: [] },
  { type: 'error', name: 'InsufficientStakedBalance', inputs: [] },
  { type: 'error', name: 'InvalidPreference', inputs: [] },

  // Vested Vaults
  { type: 'error', name: 'LockNotMatured', inputs: [] },
  { type: 'error', name: 'BondAlreadyClaimed', inputs: [] },
  { type: 'error', name: 'InvalidLockDuration', inputs: [] },
  { type: 'error', name: 'NotBondOwner', inputs: [] },

  // P2P Lending Market
  { type: 'error', name: 'LoanAlreadyActive', inputs: [] },
  { type: 'error', name: 'LoanNotActive', inputs: [] },
  { type: 'error', name: 'LoanDefaulted', inputs: [] },
  { type: 'error', name: 'LoanNotDefaulted', inputs: [] },
  { type: 'error', name: 'LoanDurationExceeded', inputs: [] },
  { type: 'error', name: 'HealthFactorTooLow', inputs: [] },
  { type: 'error', name: 'NotBorrower', inputs: [] },
  { type: 'error', name: 'NotLender', inputs: [] },
  { type: 'error', name: 'MaxDebtExceeded', inputs: [] },

  // Timelock & Governance
  { type: 'error', name: 'TimelockPending', inputs: [] },
  { type: 'error', name: 'TimelockExpired', inputs: [] },
  { type: 'error', name: 'ProposalNotActive', inputs: [] },
  { type: 'error', name: 'AlreadyVoted', inputs: [] }
] as const;

export interface DecodedWeb3Error {
  title: string;
  message: string;
  actionableHint?: string;
  code?: number | string;
  isUserRejection: boolean;
}

export function decodeWeb3Error(err: any): DecodedWeb3Error {
  if (!err) {
    return {
      title: 'Error Desconocido',
      message: 'Ocurrió un error inesperado al procesar la operación.',
      isUserRejection: false
    };
  }

  // 1. User Rejection (EIP-1193 / MetaMask / Rabby / WalletConnect)
  const isRejected = 
    err.code === 4001 ||
    err.code === 'ACTION_REJECTED' ||
    err.name === 'UserRejectedRequestError' ||
    (err.message && (
      err.message.includes('User rejected') ||
      err.message.includes('User denied') ||
      err.message.includes('rejected the request')
    ));

  if (isRejected) {
    return {
      title: 'Transacción Cancelada',
      message: 'Has rechazado la firma de la transacción en tu billetera.',
      actionableHint: 'Vuelve a intentarlo cuando desees confirmar la operación.',
      code: 4001,
      isUserRejection: true
    };
  }

  // 2. Insufficient Funds for Gas
  if (
    err.code === -32000 ||
    (err.message && (
      err.message.includes('insufficient funds for gas') ||
      err.message.includes('exceeds balance') ||
      err.message.includes('gas required exceeds allowance')
    ))
  ) {
    return {
      title: 'Saldo Insuficiente para Gas',
      message: 'Tu billetera no dispone de suficiente ETH para cubrir la tarifa de red (Gas).',
      actionableHint: 'Añade fondos de gas a tu billetera o reduce el monto ingresado.',
      code: -32000,
      isUserRejection: false
    };
  }

  // 3. Try to decode custom Solidity Error Hex Data
  const rawData = err.data || err.error?.data || (typeof err.walk === 'function' ? err.walk((e: any) => Boolean(e.data))?.data : null);
  if (rawData && typeof rawData === 'string' && rawData.startsWith('0x')) {
    try {
      const decoded = decodeErrorResult({
        abi: PROTOCOL_CUSTOM_ERRORS_ABI,
        data: rawData as `0x${string}`
      });

      if (decoded && decoded.errorName) {
        return mapSolidityErrorToMessage(decoded.errorName);
      }
    } catch {
      // Fallback if error is not in our standard ABI table
    }
  }

  // 4. Pattern matching on string revert messages
  const msg = err.shortMessage || err.message || err.toString();

  if (msg.includes('Same-block deposit/redeem cooldown') || msg.includes('SameBlockDepositRedeemCooldown')) {
    return {
      title: 'Protección Anti-Arbitraje Flash Loan',
      message: 'No puedes depositar y rescatar en el mismo bloque por seguridad de reservas.',
      actionableHint: 'Espera al siguiente bloque (aprox. 12 segundos) para operar.',
      isUserRejection: false
    };
  }

  if (msg.includes('CircuitBreaker') || msg.includes('BreakerActive')) {
    return {
      title: 'Circuit Breaker Activado',
      message: 'La tesorería se encuentra temporalmente protegida ante alta volatilidad de precios.',
      actionableHint: 'El protocolo restablecerá las operaciones en cuanto el feed del oráculo se estabilice.',
      isUserRejection: false
    };
  }

  if (msg.includes('LockNotMatured')) {
    return {
      title: 'Bono en Periodo de Bloqueo',
      message: 'El plazo de maduración del bono aún no ha concluido.',
      actionableHint: 'Puedes reclamar al vencer o utilizar la opción de Ragequit con penalización si necesitas liquidez.',
      isUserRejection: false
    };
  }

  if (msg.includes('transfer amount exceeds allowance')) {
    return {
      title: 'Permiso Requerido (Approval)',
      message: 'El contrato no tiene autorización para transferir tus tokens.',
      actionableHint: 'Aprueba el contrato inteligente en tu billetera para continuar.',
      isUserRejection: false
    };
  }

  // Generic fallback
  return {
    title: 'Transacción Fallida',
    message: err.shortMessage || err.message || 'Error de ejecución on-chain.',
    actionableHint: 'Verifica los parámetros y el estado de tu billetera antes de reintentar.',
    isUserRejection: false
  };
}

function mapSolidityErrorToMessage(errorName: string): DecodedWeb3Error {
  switch (errorName) {
    case 'InsufficientLiquidity':
      return {
        title: 'Liquidez Insuficiente en Bóveda',
        message: 'La reserva solicitada no cuenta con liquidez disponible en este momento.',
        actionableHint: 'Prueba con un importe menor o aguarda al rebalanceo de reservas.',
        isUserRejection: false
      };
    case 'ExcessiveSlippage':
      return {
        title: 'Tolerancia de Slippage Excedida',
        message: 'La variación de precio durante la transacción superó el límite permitido.',
        actionableHint: 'Aumenta el margen de slippage o reduce el tamaño de la orden.',
        isUserRejection: false
      };
    case 'SameBlockDepositRedeemCooldown':
      return {
        title: 'Cooldown Anti-Flash Loan',
        message: 'Depósito y rescate en el mismo bloque restringido por seguridad.',
        actionableHint: 'Espera al siguiente bloque para ejecutar tu transacción.',
        isUserRejection: false
      };
    case 'BreakerActive':
      return {
        title: 'Bóveda en Pausa por Volatilidad',
        message: 'El mecanismo de Circuit Breaker ha congelado temporalmente las operaciones.',
        actionableHint: 'Las operaciones se reanudarán tras la estabilización de precios.',
        isUserRejection: false
      };
    case 'LockNotMatured':
      return {
        title: 'Bono Aún No Vencido',
        message: 'Este bono NFT no ha alcanzado su fecha de maduración.',
        actionableHint: 'Espera a la fecha de vencimiento o ejecuta Ragequit.',
        isUserRejection: false
      };
    case 'LoanAlreadyActive':
      return {
        title: 'Préstamo Ya Activo',
        message: 'Esta oferta de préstamo ya ha sido financiada por otro prestamista.',
        isUserRejection: false
      };
    case 'HealthFactorTooLow':
      return {
        title: 'Ratio de Colateral Insuficiente',
        message: 'El valor de colateral aportado no cumple con el LTV mínimo de seguridad.',
        actionableHint: 'Añade más colateral para respaldar el préstamo solicitado.',
        isUserRejection: false
      };
    case 'Unauthorized':
    case 'OnlyGovernance':
      return {
        title: 'Acceso No Autorizado',
        message: 'Esta función está restringida a la gobernanza DAO del protocolo.',
        isUserRejection: false
      };
    default:
      return {
        title: `Revert: ${errorName}`,
        message: `El contrato inteligente revirtió con el error: ${errorName}.`,
        isUserRejection: false
      };
  }
}

export function parseWeb3Error(err: any): string {
  const decoded = decodeWeb3Error(err);
  return decoded.message || decoded.title || 'Error al ejecutar la transacción';
}
