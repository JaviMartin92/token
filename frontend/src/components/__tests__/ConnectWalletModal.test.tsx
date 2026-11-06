import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConnectWalletModal } from '../ConnectWalletModal.js';

describe('ConnectWalletModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ConnectWalletModal
        isOpen={false}
        onClose={vi.fn()}
        onConnectInjected={vi.fn()}
        isConnecting={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders mobile wallet connection options when isOpen is true', () => {
    render(
      <ConnectWalletModal
        isOpen={true}
        onClose={vi.fn()}
        onConnectInjected={vi.fn()}
        isConnecting={false}
      />
    );

    expect(screen.getByText('Conectar Billetera Web3')).toBeDefined();
    expect(screen.getByText('MetaMask')).toBeDefined();
    expect(screen.getByText('Trust Wallet')).toBeDefined();
    expect(screen.getByText('Coinbase Wallet')).toBeDefined();
    expect(screen.getByText('Copiar Enlace de la dApp')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <ConnectWalletModal
        isOpen={true}
        onClose={handleClose}
        onConnectInjected={vi.fn()}
        isConnecting={false}
      />
    );

    const closeBtn = screen.getByTestId('connect-wallet-modal-close-btn');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('displays error message when errorMsg is provided', () => {
    render(
      <ConnectWalletModal
        isOpen={true}
        onClose={vi.fn()}
        onConnectInjected={vi.fn()}
        isConnecting={false}
        errorMsg="Conexión cancelada por el usuario en su billetera."
      />
    );

    expect(screen.getByText('Conexión cancelada por el usuario en su billetera.')).toBeDefined();
  });
});
