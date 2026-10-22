import React from 'react';
import styles from './VestedVaults.module.css';
import { useQuery } from '@tanstack/react-query';
import { publicClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { UI_STRINGS } from '../constants/strings.js';
import { TokenAmountInput } from './common/TokenAmountInput.js';
import { queryKeys } from '../constants/queryKeys.js';

export interface UserPosition {
  id: number;
  principal: string;
  paid: string;
  expirationTimestamp: number;
  expDateStr: string;
  lockYears: string;
  isRagequitted: boolean;
  isMaturedClaimed: boolean;
  canClaim: boolean;
}

interface VestedVaultsProps {
  bondPrincipal: string;
  setBondPrincipal: (val: string) => void;
  bondLockYears: string;
  setBondLockYears: (val: string) => void;
  bondReferrer: string;
  setBondReferrer: (val: string) => void;
  onBuyBond: () => void;
  userPositions: UserPosition[];
  onClaimMatured: (id: number, pos?: UserPosition) => void;
  onRagequit: (id: number, pos?: UserPosition) => void;
  onOpenReferral?: () => void;
  userAddress?: string;
  usdcBalance?: string;
}

export const VestedVaults: React.FC<VestedVaultsProps> = ({
  bondPrincipal,
  setBondPrincipal,
  bondLockYears,
  setBondLockYears,
  bondReferrer,
  setBondReferrer,
  onBuyBond,
  userPositions,
  onClaimMatured,
  onRagequit,
  onOpenReferral,
  userAddress = '0x0000000000000000000000000000000000000000',
  usdcBalance
}) => {
  const principalNum = parseFloat(bondPrincipal) || 0;
  const yearsNum = parseInt(bondLockYears) || 1;

  const { data: discountBps = yearsNum * 500 } = useQuery({
    queryKey: queryKeys.vestedVault.discountBps(userAddress, yearsNum),
    queryFn: async () => {
      if (!CONTRACT_ADDRESSES.VESTED_VAULT) return yearsNum * 500;
      try {
        const bps = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.VESTED_VAULT,
          abi: ABIS.VESTED_VAULT,
          functionName: 'calculateDiscountBps',
          args: [(userAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`, BigInt(yearsNum)]
        }) as bigint;
        return Number(bps);
      } catch (e) {
        return yearsNum * 500;
      }
    },
    refetchInterval: 5000
  });

  const discountPct = (discountBps / 100).toFixed(1);
  const discountedPrice = (principalNum * (1 - discountBps / 10000)).toFixed(2);

  return (
    <div className="met-grid-subtle margin-bottom-xl">
      {/* Buy Bond Card */}
      <div className="glass-panel acp-proposal-card">
        <h3 className={styles.cardH3}>{UI_STRINGS.VESTED_VAULTS.TITLE}</h3>
        <p className={styles.cardP}>
          {UI_STRINGS.VESTED_VAULTS.SUBTITLE}
        </p>

        <div className="acp-control-stack">
          <div>
            <TokenAmountInput
              label={UI_STRINGS.VESTED_VAULTS.LABEL_PRINCIPAL}
              testId="bonds-principal-input"
              value={bondPrincipal}
              onChange={setBondPrincipal}
              tokenSymbol={UI_STRINGS.COMMON.SYMBOL_USDC}
              tokenDecimals={6}
              showMaxButton={true}
              maxBalance={usdcBalance}
            />
          </div>

          <div>
            <label className={styles.label}>{UI_STRINGS.VESTED_VAULTS.LABEL_LOCK_YEARS}</label>
            <select
              data-testid="bonds-years-select"
              value={bondLockYears}
              onChange={(e) => setBondLockYears(e.target.value)}
              className={styles.inputDark}
            >
              <option value="1">{UI_STRINGS.VESTED_VAULTS.YEAR_1}</option>
              <option value="2">{UI_STRINGS.VESTED_VAULTS.YEAR_2}</option>
              <option value="3">{UI_STRINGS.VESTED_VAULTS.YEAR_3}</option>
              <option value="4">{UI_STRINGS.VESTED_VAULTS.YEAR_4}</option>
              <option value="5">{UI_STRINGS.VESTED_VAULTS.YEAR_5}</option>
            </select>
          </div>

          <div>
            <div className="acp-banner-flex margin-bottom-xs">
              <label className={`${styles.label} opacity-80`}>{UI_STRINGS.VESTED_VAULTS.LABEL_REFERRER}</label>
              {onOpenReferral && (
                <button
                  type="button"
                  onClick={onOpenReferral}
                  className={styles.linkBtn}
                >
                  {UI_STRINGS.VESTED_VAULTS.BTN_MY_REFERRAL_LINK}
                </button>
              )}
            </div>
            <input
              data-testid="bonds-referrer-input"
              type="text"
              placeholder={UI_STRINGS.VESTED_VAULTS.REFERRER_PLACEHOLDER}
              value={bondReferrer}
              onChange={(e) => setBondReferrer(e.target.value)}
              className={styles.inputDark}
            />
          </div>

          {/* Discount Summary Box */}
          <div className={styles.discountBox}>
            <div className="acp-banner-flex margin-bottom-xs">
              <span>{UI_STRINGS.VESTED_VAULTS.DISCOUNT_SUMMARY_TITLE}</span>
              <strong data-testid="bonds-discount-badge" className="stk-val-purple">{discountPct}% OFF</strong>
            </div>
            <div className="acp-banner-flex">
              <span>{UI_STRINGS.VESTED_VAULTS.LABEL_PRICE_TO_PAY}</span>
              <strong data-testid="bonds-price-today" className="stk-val-green">${discountedPrice} {UI_STRINGS.COMMON.SYMBOL_USDC}</strong>
            </div>
          </div>

          <button data-testid="bonds-buy-btn" className={`btn-primary ${styles.buyBtn}`} onClick={onBuyBond}>
            {UI_STRINGS.VESTED_VAULTS.BTN_BUY_BOND}
          </button>
        </div>
      </div>

      {/* Position NFTs Gallery Card */}
      <div className="glass-panel acp-proposal-card">
        <h3 className={styles.cardH3}>{UI_STRINGS.VESTED_VAULTS.TABLE_TITLE} ({userPositions.length})</h3>

        {userPositions.length === 0 ? (
          <div className={styles.emptyGallery}>
            {UI_STRINGS.VESTED_VAULTS.TABLE_EMPTY}
          </div>
        ) : (
          <div className={styles.galleryStack}>
            {userPositions.map((pos) => (
              <div
                key={pos.id}
                className={`${styles.posCard} ${pos.isRagequitted || pos.isMaturedClaimed ? styles.posCardClaimed : (pos.canClaim ? styles.posCardCanclaim : styles.posCardNormal)}`}
              >
                <div>
                  <div className={styles.posTitle}>
                    Bono NFT #{pos.id} • {pos.lockYears} Años
                  </div>
                  <div className={styles.posSub}>
                    Principal: <strong>${pos.principal} USD</strong> | Pagado: ${pos.paid} USD
                  </div>
                  <div className={styles.posDate}>
                    Vence: {pos.expDateStr}
                  </div>
                </div>

                <div className="acp-flex-row-gap5">
                  {pos.isRagequitted && <span className={styles.badgeRq}>{UI_STRINGS.VESTED_VAULTS.BADGE_RAGEQUITTED}</span>}
                  {pos.isMaturedClaimed && <span className={styles.badgeCl}>{UI_STRINGS.VESTED_VAULTS.BADGE_CLAIMED}</span>}

                  {pos.canClaim && (
                    <button className={`btn-primary ${styles.claimBtn}`} onClick={() => onClaimMatured(pos.id)}>
                      {UI_STRINGS.VESTED_VAULTS.BTN_CLAIM_MATURED}
                    </button>
                  )}

                  {!pos.isRagequitted && !pos.isMaturedClaimed && (
                    <button className={`btn-secondary ${styles.rqBtn}`} onClick={() => onRagequit(pos.id)}>
                      {UI_STRINGS.VESTED_VAULTS.BTN_RAGEQUIT}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};