"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yield_oracle_keeper_js_1 = require("../yield-oracle-keeper.js");
async function runYieldOracleKeeperTestSuite() {
    console.log('============================================================');
    console.log('   DYNAMIC YIELD ORACLE & CONSERVATIVE KEEPER TEST SUITE    ');
    console.log('============================================================\n');
    let passed = 0;
    let failed = 0;
    function assert(condition, testName) {
        if (condition) {
            console.log(`  [PASS] ${testName}`);
            passed++;
        }
        else {
            console.error(`  [FAIL] ${testName}`);
            failed++;
        }
    }
    // 1. Data Sourcing Tests
    console.log('[1/3] Testing Dynamic Live Yield Sourcing...');
    try {
        const morphoRate = await (0, yield_oracle_keeper_js_1.fetchMorphoUsdcApy)();
        assert(morphoRate.assetClass === 0, 'Morpho rate assetClass is 0 (Stablecoin)');
        assert(morphoRate.apyBps >= 100 && morphoRate.apyBps <= 1500, `Morpho live APY within bounds (got ${morphoRate.apyBps} bps / ${morphoRate.apyPct.toFixed(2)}%)`);
        assert(morphoRate.isVerified, 'Morpho protocol is security verified');
        const lidoRate = await (0, yield_oracle_keeper_js_1.fetchLidoEthApy)();
        assert(lidoRate.assetClass === 1, 'Lido rate assetClass is 1 (Ethereum)');
        assert(lidoRate.apyBps >= 100 && lidoRate.apyBps <= 800, `Lido live APR within bounds (got ${lidoRate.apyBps} bps / ${lidoRate.apyPct.toFixed(2)}%)`);
        assert(lidoRate.isVerified, 'Lido protocol is security verified');
        const lombardRate = await (0, yield_oracle_keeper_js_1.fetchLombardBtcApy)();
        assert(lombardRate.assetClass === 2, 'Lombard rate assetClass is 2 (Bitcoin)');
        assert(lombardRate.apyBps >= 50 && lombardRate.apyBps <= 800, `Lombard live APY within bounds (got ${lombardRate.apyBps} bps / ${lombardRate.apyPct.toFixed(2)}%)`);
        assert(lombardRate.isVerified, 'Lombard protocol is security verified');
    }
    catch (err) {
        assert(false, `Live sourcing threw unexpected error: ${err.message}`);
    }
    // 2. Conservative Sanity Bounds Validation Tests
    console.log('\n[2/3] Testing Conservative Sanity Bounds (Protocol Survival)...');
    const mockValidRate = {
        assetClass: 0,
        protocolName: 'Morpho Blue MetaMorpho Vault',
        vaultAddress: '0x488102554708C23C0227d8D86f4A2fAffbb27357',
        apyBps: 550, // 5.50%
        apyPct: 5.50,
        source: 'Test',
        timestamp: Date.now(),
        isVerified: true
    };
    const validRes = (0, yield_oracle_keeper_js_1.validateConservativeRate)(mockValidRate, 520);
    assert(validRes.isValid, 'Accepts rate within conservative bounds (5.50% APY)');
    // Test Out of Bounds (< min)
    const mockTooLow = { ...mockValidRate, apyBps: 20, apyPct: 0.20 };
    const lowRes = (0, yield_oracle_keeper_js_1.validateConservativeRate)(mockTooLow);
    assert(!lowRes.isValid && lowRes.reason.includes('out of sanity bounds'), 'Rejects rate below minimum sanity bound (0.20%)');
    // Test Out of Bounds (> max)
    const mockTooHigh = { ...mockValidRate, apyBps: 2500, apyPct: 25.00 };
    const highRes = (0, yield_oracle_keeper_js_1.validateConservativeRate)(mockTooHigh);
    assert(!highRes.isValid && highRes.reason.includes('out of sanity bounds'), 'Rejects rate above maximum sanity bound (25.00%)');
    // 3. Anti-Manipulation Volatility Spike Guard
    console.log('\n[3/3] Testing Anti-Manipulation Volatility Spike Guard...');
    // Current on-chain is 500 bps, new rate is 900 bps (delta 400 > maxDelta 300)
    const mockSpikeRate = { ...mockValidRate, apyBps: 900, apyPct: 9.00 };
    const spikeRes = (0, yield_oracle_keeper_js_1.validateConservativeRate)(mockSpikeRate, 500);
    assert(!spikeRes.isValid && spikeRes.reason.includes('Volatility spike detected'), 'Rejects volatility spike exceeding delta threshold (delta 400 bps > 300 bps)');
    console.log('\n============================================================');
    console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================');
    if (failed > 0) {
        process.exit(1);
    }
}
runYieldOracleKeeperTestSuite().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
//# sourceMappingURL=yield-oracle-keeper.test.js.map