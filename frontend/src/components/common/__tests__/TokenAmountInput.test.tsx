import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TokenAmountInput } from '../TokenAmountInput.js';

describe('TokenAmountInput Component', () => {
  it('renders correctly with label, symbol and balance', () => {
    const handleChange = vi.fn();
    render(
      <TokenAmountInput
        label="Depósito USDC"
        testId="test-token-input"
        value="100"
        onChange={handleChange}
        tokenSymbol="USDC"
        tokenDecimals={6}
        maxBalance="5000.00"
      />
    );

    expect(screen.getByText('Depósito USDC')).toBeDefined();
    expect(screen.getByText('USDC')).toBeDefined();
    expect(screen.getByText(/Saldo: 5000.00 USDC/)).toBeDefined();
    const input = screen.getByTestId('test-token-input') as HTMLInputElement;
    expect(input.value).toBe('100');
  });

  it('sets max balance on MAX button click', () => {
    const handleChange = vi.fn();
    render(
      <TokenAmountInput
        testId="test-token-input"
        value=""
        onChange={handleChange}
        tokenSymbol="USDC"
        tokenDecimals={6}
        maxBalance={2500}
      />
    );

    const maxBtn = screen.getByText('MAX');
    fireEvent.click(maxBtn);
    expect(handleChange).toHaveBeenCalledWith('2500');
  });

  it('displays warning when entered amount exceeds balance', () => {
    render(
      <TokenAmountInput
        testId="test-token-input"
        value="6000"
        onChange={() => {}}
        tokenSymbol="USDC"
        tokenDecimals={6}
        maxBalance="5000"
      />
    );

    expect(screen.getByText(/Saldo insuficiente/)).toBeDefined();
  });
});
