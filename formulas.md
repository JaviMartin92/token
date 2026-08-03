# 📐 Alpha Centauri Protocol - Mathematical Formulas Specification

This document contains **all mathematical formulas** implemented across the Alpha Centauri Protocol smart contracts and system components.

---

## 1. System & Protocol Decimal Units

| Asset / Parameter | Token Symbol | Decimals | Base Multiplier |
| :--- | :--- | :--- | :--- |
| **Stablecoin (Reserves & Redemptions)** | USDC / USDT | `6` | $10^6$ |
| **Bitcoin Reserve Asset** | WBTC | `8` | $10^8$ |
| **Ethereum Reserve Asset** | WETH | `18` | $10^{18}$ |
| **Native Protocol Shares** | ALPHA | `18` | $10^{18}$ |
| **Chainlink Price Feeds** | USD Feeds | `8` | $10^8$ |
| **Basis Points (BPS)** | - | `2` (100% = 10,000) | $1 = 0.01\%$ |

---

## 2. Treasury & Net Asset Value (NAV)

### 2.1 Deposit Entry Fee & Net Deposit
When a user deposits stablecoins (`USDC`), a **0.50% (50 BPS)** entry fee is applied (unless deposited by `RealYieldRouter` where fee = 0):

$$\text{Fee Amount} = \frac{\text{Actual Deposited} \times 50}{10\,000}$$

$$\text{Net Deposited} = \text{Actual Deposited} - \text{Fee Amount}$$

### 2.2 Deposit Value Conversion to 18 Decimals
Convert 6-decimal USDC `Net Deposited` into 18-decimal USD representation:

$$\text{Deposit Value USD} = \text{Net Deposited} \times 10^{(18 - \text{redemptionTokenDecimals})}$$

### 2.3 Share Minting Formula
Shares minted for the depositor depend on pre-deposit NAV and existing total supply:

$$\text{Shares Minted} = \begin{cases} \text{Deposit Value USD}, & \text{if } \text{Total Shares} = 0 \text{ or } \text{NAV}_{\text{pre}} = 0 \\ \frac{\text{Deposit Value USD} \times \text{Total Shares}}{\text{NAV}_{\text{pre}}}, & \text{otherwise} \end{cases}$$

### 2.4 Entry Fee Distribution
$$\text{Ops Share} = \frac{\text{Fee Amount}}{4} \quad (25\%)$$

$$\text{Corporate Revenue Share} = \frac{\text{Fee Amount}}{4} \quad (25\%)$$

$$\text{Real Yield Router Share} = \frac{\text{Fee Amount}}{2} \quad (50\%)$$

### 2.5 Share Redemption & Exit Fee
When redeeming `ALPHA` shares, a **1.00% (100 BPS)** exit fee is deducted:

$$\text{Gross USD Entitlement} = \frac{\text{Shares} \times \text{NAV}}{\text{Total Shares}}$$

$$\text{Gross Asset Amount} = \frac{\text{Gross USD Entitlement}}{10^{(18 - \text{redemptionTokenDecimals})}}$$

$$\text{Redeem Fee} = \frac{\text{Gross Asset Amount} \times 100}{10\,000}$$

$$\text{Net Assets Received} = \text{Gross Asset Amount} - \text{Redeem Fee}$$

### 2.6 Oracle Asset Valuation Formula
Converts token balances of tracked assets (`USDC`, `WBTC`, `WETH`) to 18-decimal USD value using Chainlink price feeds (8 decimals):

$$\text{Asset Value USD} = \frac{\text{Balance} \times \text{Oracle Price} \times 10^{18}}{10^{\text{Asset Decimals}} \times 10^{\text{Feed Decimals}}}$$

### 2.7 Net Asset Value (NAV)
Total NAV is the aggregate USD value of all liquid reserves, sub-reserves, and protocol receivables:

$$\text{NAV} = \sum_{i} \text{Asset Value USD}_i + \text{Morpho Reserves USD} + \text{P2P Receivables USD} - \text{Vault Liabilities USD}$$

### 2.8 Proof of Reserves (PoR) & Solvency Ratio
$$\text{Total Assets USD} = \sum \text{Reserve Assets USD} + \text{P2P Receivables USD} + \text{Morpho Yield Adapter USD}$$

$$\text{Total Liabilities USD} = \text{NAV} + \text{Vested Vault Present Liabilities USD}$$

$$\text{Collateralization Ratio BPS} = \frac{\text{Total Assets USD} \times 10\,000}{\text{Total Liabilities USD}}$$

*Solvency Requirement*: $\text{Collateralization Ratio} \ge 10\,000$ ($100.00\%$).

### 2.9 Sub-Reserve Allocation Target Weights
- **Stablecoins (USDC / USDT)**: $50.00\%$ ($5\,000$ BPS)
- **Bitcoin (WBTC)**: $25.00\%$ ($2\,500$ BPS)
- **Ethereum (WETH)**: $12.50\%$ ($1\,250$ BPS)
- **Native Staking (ALPHA)**: $12.50\%$ ($1\,250$ BPS)

$$\sum \text{Weights} = 5000 + 2500 + 1250 + 1250 = 10\,000 \quad (100.00\%)$$

### 2.10 Morpho Yield Auto-Routing Sub-Allocation
$80.00\%$ of the 50% Stablecoin Target Reserve (which equals $40.00\%$ of net USDC deposits) is auto-routed to the `MorphoYieldVaultAdapter`:

$$\text{Morpho Deposit Amount} = \frac{\text{Net Deposited} \times 5000}{10\,000} \times \frac{8000}{10\,000} = \text{Net Deposited} \times 0.40$$

### 2.11 Portfolio Sanity Bounds
- **Stablecoins**: Min $40.00\%$ ($4\,000$ BPS), Max $80.00\%$ ($8\,000$ BPS)
- **WBTC**: Min $10.00\%$ ($1\,000$ BPS), Max $40.00\%$ ($4\,000$ BPS)
- **WETH**: Min $5.00\%$ ($500$ BPS), Max $30.00\%$ ($3\,000$ BPS)
- **ALPHA Staking**: Min $5.00\%$ ($500$ BPS), Max $25.00\%$ ($2\,500$ BPS)

---

## 3. Vested Discount Vault (Bonds & NFTs)

### 3.1 Bond Discount Percentage Formula
Discount BPS depends on duration (1 to 5 years) and user's governance staked balance:

$$\text{Discount BPS} = (\text{Lock Years} \times \text{Base Yield Rate BPS}) + \text{Subsidy BPS} + \text{Tier Bonus BPS}$$

where:
- $\text{Base Yield Rate BPS} = 500$ ($5.00\%$ per year)
- Max Cap $= 5000$ ($50.00\%$)

**Governance Staking Tier Bonus**:
$$\text{Tier Bonus BPS} = \begin{cases} 300 \, (+3.0\%), & \text{staked} \ge 20\,000 \text{ ALPHA} \\ 200 \, (+2.0\%), & \text{staked} \ge 10\,000 \text{ ALPHA} \\ 100 \, (+1.0\%), & \text{staked} \ge 5\,000 \text{ ALPHA} \\ 0, & \text{otherwise} \end{cases}$$

### 3.2 Discounted Purchase Price
$$\text{Discounted Price Paid} = \frac{\text{Principal Amount} \times (10\,000 - \text{Discount BPS})}{10\,000}$$

### 3.3 Fee & Referral Payout Splits on Purchase
$$\text{Referral Reward} = \frac{\text{Discounted Price Paid} \times 150}{10\,000} \quad (1.50\%)$$

$$\text{Protocol Mint Fee} = \frac{\text{Discounted Price Paid} \times 150}{10\,000} \quad (1.50\%)$$

$$\text{Net to Treasury} = \text{Discounted Price Paid} - \text{Referral Reward} - \text{Protocol Mint Fee}$$

### 3.4 Ragequit Penalty & Refund Calculation
If a user exits early before bond maturity:

$$\text{Penalty Total} = \frac{\text{Discounted Price Paid} \times 1500}{10\,000} \quad (15.00\% \text{ Penalty})$$

$$\text{User Refund} = \text{Discounted Price Paid} - \text{Penalty Total}$$

$$\text{Penalty Distribution}: \begin{cases} 50\%, & \text{Treasury Bunker} \\ 25\%, & \text{Ops Wallet} \\ 25\%, & \text{Real Yield Router / Staking Flywheel} \end{cases}$$

### 3.5 Linear Present Liability Accretion
For un-matured active bond positions, present liability grows linearly from net capital received to full principal:

$$\text{Net Capital Received} = \frac{\text{Discounted Price Paid} \times 9850}{10\,000}$$

$$\text{Total Duration} = \text{Expiration Timestamp} - \text{Deposit Timestamp}$$

$$\text{Elapsed} = \min(\text{Block Timestamp} - \text{Deposit Timestamp}, \text{Total Duration})$$

$$\text{Accrued} = \frac{(\text{Principal Amount} - \text{Net Capital Received}) \times \text{Elapsed}}{\text{Total Duration}}$$

$$\text{Present Liability USD} = \text{Net Capital Received} + \text{Accrued}$$

---

## 4. P2P Lending Market (Overcollateralized Escrow)

### 4.1 Maximum Borrow Capacity (Max LTV)
Borrowers can borrow up to **70.00% (7000 BPS)** of the collateral position value:

$$\text{Max Borrow Amount} = \frac{\text{Collateral Value USD} \times 7000}{10\,000}$$

### 4.2 Loan Origination Fee
$$\text{Origination Fee} = \frac{\text{Borrow Amount} \times 50}{10\,000} \quad (0.50\%)$$

$$\text{Net Principal Disbursed} = \text{Borrow Amount} - \text{Origination Fee}$$

### 4.3 Simple Interest Calculation
$$\text{Interest Owed} = \frac{\text{Borrow Amount} \times \text{APR BPS} \times \text{Duration Days}}{365 \times 10\,000}$$

$$\text{Total Owed} = \text{Borrow Amount} + \text{Interest Owed}$$

*Constraint*: $\text{APR BPS} \le 5000$ ($50.00\%$ Max APR).

### 4.4 Health Factor Ratio
$$\text{Health Factor Ratio} = \frac{\text{Collateral USD} \times 100}{\text{Total Owed}}$$

### 4.5 Liquidation Threshold Condition
A loan is liquidatable if the Health Factor drops below **115%** OR if the loan duration has expired:

$$\text{Liquidatable} = (\text{Health Factor Ratio} < 115) \lor (\text{Block Timestamp} > \text{Start Time} + \text{Duration Days})$$

### 4.6 Interest Spread & Fee Distribution on Repayment
$$\text{Fee Spread} = \frac{\text{Interest Owed} \times 1000}{10\,000} \quad (10.00\% \text{ Interest Spread to Stakers})$$

$$\text{Lender Payout} = \text{Total Owed} - \text{Fee Spread}$$

$$\text{Treasury Reserve Accretion} = \text{Interest Owed} - \text{Fee Spread} \quad (90.00\% \text{ Accretion to Reserves})$$

---

## 5. Governance Staking & Real Yield Flywheel

### 5.1 Staking Entry Fee & Net Staked Shares
$$\text{Staking Entry Fee} = \frac{\text{Amount} \times 100}{10\,000} \quad (1.00\%)$$

$$\text{Net Staked Shares} = \text{Amount} - \text{Staking Entry Fee}$$

### 5.2 Synthetix-Style Reward Per Token Accrual
$$\text{Reward Per Token} = \text{Stored RPT} + \frac{\text{Reward Rate} \times (\text{Last Time} - \text{Last Update Time}) \times 10^{18}}{\text{Total Staked}}$$

### 5.3 User Earned Real Yield Rewards
$$\text{Earned} = \frac{\text{User Balance} \times (\text{Reward Per Token} - \text{User Paid RPT})}{10^{18}} + \text{Stored Rewards}$$

### 5.4 Universal Real Yield Fee Split
$$\text{Treasury Bunker Share} = \frac{\text{Fee Balance} \times 5000}{10\,000} \quad (50.00\%)$$

$$\text{Corporate OpEx Vault Share} = \frac{\text{Fee Balance} \times 2500}{10\,000} \quad (25.00\%)$$

$$\text{Corporate Profit Vault Share} = \frac{\text{Fee Balance} \times 2500}{10\,000} \quad (25.00\%)$$

---

## 6. Atomic Swap & Slippage Protection

### 6.1 Maximum Slippage Limit
Max allowable slippage on stablecoin swaps (`USDT` $\rightarrow$ `USDC`) is **0.05% (5 BPS)**:

$$\text{Max Slippage BPS} = 5 \quad (0.05\%)$$

$$\text{Minimum Output Expected} = \frac{\text{Input Amount} \times (10\,000 - 5)}{10\,000} = \text{Input Amount} \times 0.9995$$

$$\text{Slippage Check Requirement}: \text{Min Expected Output} \ge \text{Input Amount} \times 0.9995$$

---

## 7. Circuit Breaker (Stop-Loss Volatility Guard)

### 7.1 Asset Price Deviation Percentage
Calculates price deviation over a rolling 24-hour window:

$$\text{Price Deviation BPS} = \frac{|\text{Current Price} - \text{Last Price}| \times 10\,000}{\text{Last Price}}$$

### 7.2 Emergency Freeze Trigger Threshold
$$\text{Freeze Condition}: \text{Price Deviation BPS} > 1500 \quad (15.00\% \text{ Max Deviation})$$

---

## 8. Corporate TWAP Buyback & Token Burn

### 8.1 TWAP Step Allocation
$$\text{Amount Per Interval} = \frac{\text{Total USDC Allocation}}{\text{Total Intervals}}$$

$$\text{Interval Lock Duration} = \text{Interval Seconds} \quad (\text{e.g., } 3600 \text{ seconds = 1 hour})$$

### 8.2 Buyback Split (50% Auto-Stake / 50% Permanent Burn)
$$\text{Tokens to Auto-Stake} = \frac{\text{ALPHA Bought}}{2} \quad (50.00\%)$$

$$\text{Tokens to Burn Address} = \frac{\text{ALPHA Bought}}{2} \quad (50.00\% \text{ to } \texttt{0x0000...dEaD})$$

---

## 9. Morpho & Compound Yield Harvesting

### 9.1 Net Yield Accrual
$$\text{Gross Yield Harvested} = \text{Current Morpho Vault Balance} - \text{Initial Invested Principal}$$

$$\text{Net Yield to Treasury} = \max(0, \text{Gross Yield Harvested})$$
