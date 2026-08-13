import { describe, it, expect } from 'vitest';
import { calculateProtocolApyMath } from '../ApyBreakdownModal';

describe('calculateProtocolApyMath', () => {
  it('should return 0 APY when reserves and rates are 0', () => {
    const res = calculateProtocolApyMath(
      '0.00',
      { stables: 0, wbtc: 0, weth: 0, alphaStaking: 0 },
      '0',
      0,
      0,
      0,
      0,
      { stablesApyPct: 0, ethApyPct: 0, btcApyPct: 0 },
      1.0
    );

    expect(res.numericAssetsUSD).toBe(0);
    expect(res.realTimeBaseApyPct).toBe(0);
    expect(res.flywheelApyPct).toBe(0);
    expect(res.totalApyPct).toBe('0.00');
  });

  it('should calculate base reserve yield correctly with $100k reserves and dynamic NAV per share', () => {
    const res = calculateProtocolApyMath(
      '100000.00',
      { stables: 60000, wbtc: 26670, weth: 13330, alphaStaking: 0 },
      '10000',
      1000,
      5000,
      0,
      400,
      { stablesApyPct: 0.08, ethApyPct: 0.04, btcApyPct: 0.02 },
      1.05
    );

    expect(res.numericAssetsUSD).toBe(100000);
    expect(res.numericStakedAlpha).toBe(10000);
    // Morpho (90% of $60,000 = $54,000 @ 8% = $4,320)
    expect(res.morphoUSDPool).toBe(54000);
    expect(res.morphoUSDYield).toBe(4320);
    // LBTC ($26,670 @ 2% = $533.40)
    expect(res.lbtcUSDYield).toBeCloseTo(533.40, 2);
    // wstETH ($13,330 @ 4% = $533.20)
    expect(res.wstEthUSDYield).toBeCloseTo(533.20, 2);
    // Treasury active loan interest ($400)
    expect(res.treasuryLoanUSDYield).toBe(400);

    // Total yield = 4320 + 533.4 + 533.2 + 400 = 5786.6
    expect(res.totalAnnualYieldUSD).toBeCloseTo(5786.60, 2);
    // Base APY % = 5786.6 / 100000 * 100 = 5.7866%
    expect(res.realTimeBaseApyPct).toBeCloseTo(5.7866, 3);
  });
});
