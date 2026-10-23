import React from 'react';
import styles from './VestedVaults.module.css';
import { useQuery } from '@tanstack/react-query';
import { publicClient, CONTRACT_ADDRESSES, ABIS } from '../utils/web3.js';
import { UI_STRINGS } from '../constants/strings.js';
import { Card, Button, Badge, TokenAmountInput } from './common/index.js';
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
    <div className={styles.container}>
      {/* 🏛️ Tarjeta 1: Suscripción de Bonos con Descuento */}
      <Card
        variant="surface"
        collapsible
        defaultExpanded={true}
        headerTitle={UI_STRINGS.VESTED_VAULTS.TITLE}
        headerSubtitle={UI_STRINGS.VESTED_VAULTS.SUBTITLE}
      >
        <div className={styles.formStack}>
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

          <div className={styles.fieldGroup}>
            <label htmlFor="bonds-years-select" className={styles.label}>
              {UI_STRINGS.VESTED_VAULTS.LABEL_LOCK_YEARS}
            </label>
            <select
              id="bonds-years-select"
              data-testid="bonds-years-select"
              value={bondLockYears}
              onChange={(e) => setBondLockYears(e.target.value)}
              className={styles.select}
            >
              <option value="1">{UI_STRINGS.VESTED_VAULTS.YEAR_1}</option>
              <option value="2">{UI_STRINGS.VESTED_VAULTS.YEAR_2}</option>
              <option value="3">{UI_STRINGS.VESTED_VAULTS.YEAR_3}</option>
              <option value="4">{UI_STRINGS.VESTED_VAULTS.YEAR_4}</option>
              <option value="5">{UI_STRINGS.VESTED_VAULTS.YEAR_5}</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="bonds-referrer-input" className={styles.label}>
                {UI_STRINGS.VESTED_VAULTS.LABEL_REFERRER}
              </label>
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
              id="bonds-referrer-input"
              data-testid="bonds-referrer-input"
              type="text"
              placeholder={UI_STRINGS.VESTED_VAULTS.REFERRER_PLACEHOLDER}
              value={bondReferrer}
              onChange={(e) => setBondReferrer(e.target.value)}
              className={styles.input}
            />
          </div>

          {/* Resumen de Descuento */}
          <div className={styles.discountBox}>
            <div className={styles.discountRow}>
              <span>{UI_STRINGS.VESTED_VAULTS.DISCOUNT_SUMMARY_TITLE}</span>
              <span data-testid="bonds-discount-badge" style={{ color: '#c084fc', fontWeight: 700 }}>
                {discountPct}% OFF
              </span>
            </div>
            <div className={styles.discountRow}>
              <span>{UI_STRINGS.VESTED_VAULTS.LABEL_PRICE_TO_PAY}</span>
              <span data-testid="bonds-price-today" style={{ color: 'var(--color-emerald-light)', fontWeight: 700 }}>
                ${discountedPrice} {UI_STRINGS.COMMON.SYMBOL_USDC}
              </span>
            </div>
          </div>

          <Button
            data-testid="bonds-buy-btn"
            variant="primary"
            size="md"
            className={styles.submitBtn}
            onClick={onBuyBond}
          >
            {UI_STRINGS.VESTED_VAULTS.BTN_BUY_BOND}
          </Button>
        </div>
      </Card>

      {/* 🎴 Tarjeta 2: Posiciones de Bonos NFT del Usuario */}
      <Card
        variant="surface"
        collapsible
        defaultExpanded={true}
        headerTitle={`${UI_STRINGS.VESTED_VAULTS.TABLE_TITLE} (${userPositions.length})`}
        headerSubtitle="Posiciones activas, maduradas y opciones de liquidación temprana (Ragequit)"
      >
        {userPositions.length === 0 ? (
          <div className={styles.emptyGallery}>
            {UI_STRINGS.VESTED_VAULTS.TABLE_EMPTY}
          </div>
        ) : (
          <div className={styles.galleryStack}>
            {userPositions.map((pos) => (
              <div
                key={pos.id}
                className={
                  pos.isRagequitted || pos.isMaturedClaimed
                    ? styles.posCardClaimed
                    : pos.canClaim
                    ? styles.posCardCanclaim
                    : styles.posCard
                }
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

                <div className={styles.actionsGroup}>
                  {pos.isRagequitted && (
                    <Badge variant="crimson" size="sm">
                      {UI_STRINGS.VESTED_VAULTS.BADGE_RAGEQUITTED}
                    </Badge>
                  )}
                  {pos.isMaturedClaimed && (
                    <Badge variant="blue" size="sm">
                      {UI_STRINGS.VESTED_VAULTS.BADGE_CLAIMED}
                    </Badge>
                  )}

                  {pos.canClaim && (
                    <Button
                      variant="emerald"
                      size="sm"
                      onClick={() => onClaimMatured(pos.id)}
                    >
                      {UI_STRINGS.VESTED_VAULTS.BTN_CLAIM_MATURED}
                    </Button>
                  )}

                  {!pos.isRagequitted && !pos.isMaturedClaimed && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRagequit(pos.id)}
                    >
                      {UI_STRINGS.VESTED_VAULTS.BTN_RAGEQUIT}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
