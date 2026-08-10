import React from 'react';
import styles from './VestedVaults.module.css';

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
  onClaimMatured: (tokenId: number) => void;
  onRagequit: (tokenId: number) => void;
  onOpenReferral?: () => void;
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
  onOpenReferral
}) => {
  const principalNum = parseFloat(bondPrincipal) || 0;
  const yearsNum = parseInt(bondLockYears) || 1;
  const baseDiscountBps = Math.min(yearsNum * 500, 2500); // 5% per year (1yr=5%, 3yr=15%, 5yr=25%)
  const discountPct = (baseDiscountBps / 100).toFixed(1);
  const discountedPrice = (principalNum * (1 - baseDiscountBps / 10000)).toFixed(2);

  return (
    <div className="met-grid-subtle margin-bottom-xl">
      {/* Buy Bond Card */}
      <div className="glass-panel acp-proposal-card">
        <h3 className={styles.cardH3}>📜 Bóveda de Bonos Vestados con Descuento</h3>
        <p className={styles.cardP}>
          Adquiere posición en el protocolo a un precio con descuento locking a 1-5 años. Recibes un NFT ERC-721 como colateral transferible.
        </p>

        <div className="acp-control-stack">
          <div>
            <label className={styles.label}>Valor Principal del Bono (USD):</label>
            <input
              data-testid="bonds-principal-input"
              type="number"
              value={bondPrincipal}
              onChange={(e) => setBondPrincipal(e.target.value)}
              className={styles.inputDark}
            />
          </div>

          <div>
            <label className={styles.label}>Años de Bloqueo (1 - 5 años):</label>
            <select
              data-testid="bonds-years-select"
              value={bondLockYears}
              onChange={(e) => setBondLockYears(e.target.value)}
              className={styles.inputDark}
            >
              <option value="1">1 Año (Descuento ~10%)</option>
              <option value="2">2 Años (Descuento ~18%)</option>
              <option value="3">3 Años (Descuento ~26%)</option>
              <option value="4">4 Años (Descuento ~34%)</option>
              <option value="5">5 Años (Descuento Máximo 40%)</option>
            </select>
          </div>

          <div>
            <div className="acp-banner-flex margin-bottom-xs">
              <label className={`${styles.label} opacity-80`}>Dirección Referidor (Opcional - 1.5% Reward USDC):</label>
              {onOpenReferral && (
                <button
                  type="button"
                  onClick={onOpenReferral}
                  className={styles.linkBtn}
                >
                  🎁 Mi Enlace de Referido
                </button>
              )}
            </div>
            <input
              data-testid="bonds-referrer-input"
              type="text"
              placeholder="0x..."
              value={bondReferrer}
              onChange={(e) => setBondReferrer(e.target.value)}
              className={styles.inputDark}
            />
          </div>

          {/* Discount Summary Box */}
          <div className={styles.discountBox}>
            <div className="acp-banner-flex margin-bottom-xs">
              <span>Descuento Calculado:</span>
              <strong data-testid="bonds-discount-badge" className="stk-val-purple">{discountPct}% OFF</strong>
            </div>
            <div className="acp-banner-flex">
              <span>Precio a Pagar Hoy:</span>
              <strong data-testid="bonds-price-today" className="stk-val-green">${discountedPrice} USDC</strong>
            </div>
          </div>

          <button data-testid="bonds-buy-btn" className={`btn-primary ${styles.buyBtn}`} onClick={onBuyBond}>
            💳 Comprar Bono Vestado & Mint NFT
          </button>
        </div>
      </div>

      {/* Position NFTs Gallery Card */}
      <div className="glass-panel acp-proposal-card">
        <h3 className={styles.cardH3}>🎨 Mis Posiciones ERC-721 ({userPositions.length})</h3>

        {userPositions.length === 0 ? (
          <div className={styles.emptyGallery}>
            No posees ninguna posición NFT de bono vestado activa.
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
                  {pos.isRagequitted && <span className={styles.badgeRq}>Ragequitted</span>}
                  {pos.isMaturedClaimed && <span className={styles.badgeCl}>Reclamado</span>}

                  {pos.canClaim && (
                    <button className={`btn-primary ${styles.claimBtn}`} onClick={() => onClaimMatured(pos.id)}>
                      Reclamar
                    </button>
                  )}

                  {!pos.isRagequitted && !pos.isMaturedClaimed && (
                    <button className={`btn-secondary ${styles.rqBtn}`} onClick={() => onRagequit(pos.id)}>
                      Ragequit (Penalización 15%)
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