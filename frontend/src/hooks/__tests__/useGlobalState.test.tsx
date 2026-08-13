import { renderHook, act } from '@testing-library/react';
import { useGlobalState } from '../useGlobalState';
import { describe, it, expect, vi } from 'vitest';
import * as wagmi from 'wagmi';

// Mock wagmi
vi.mock('wagmi', () => {
  return {
    useAccount: vi.fn(),
    useConnect: vi.fn(),
    useDisconnect: vi.fn(),
  };
});

describe('useGlobalState', () => {
  it('should initialize with default sandbox wallet state when disconnected', () => {
    (wagmi.useAccount as any).mockReturnValue({
      address: undefined,
      isConnected: false,
    });

    const { result } = renderHook(() => useGlobalState());

    expect(result.current.walletConnected).toBe(true);
    expect(result.current.userAddress).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    expect(result.current.snapshotId).toBe('');
  });

  it('should reflect connected state and address', () => {
    (wagmi.useAccount as any).mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      isConnected: true,
    });

    const { result } = renderHook(() => useGlobalState());

    expect(result.current.walletConnected).toBe(true);
    expect(result.current.userAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  it('should allow setting snapshotId', () => {
    (wagmi.useAccount as any).mockReturnValue({
      address: undefined,
      isConnected: false,
    });

    const { result } = renderHook(() => useGlobalState());

    act(() => {
      result.current.setSnapshotId('42');
    });

    expect(result.current.snapshotId).toBe('42');
  });
});
