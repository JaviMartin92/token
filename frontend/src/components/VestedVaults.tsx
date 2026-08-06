import React from 'react';

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
  const baseDiscountBps = Math.min(800 * yearsNum + 200, 4000); // 8% per year + 2% bonus (Max 40%)
  const discountPct = (baseDiscountBps / 100).toFixed(1);
  const discountedPrice = (principalNum * (1 - baseDiscountBps / 10000)).toFixed(2);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
      {/* Buy Bond Card */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem' }}>📜 Bóveda de Bonos Vestados con Descuento</h3>
        <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '1rem' }}>
          Adquiere posición en el protocolo a un precio con descuento locking a 1-5 años. Recibes un NFT ERC-721 como colateral transferible.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>Valor Principal del Bono (USD):</label>
            <input
              data-testid="bonds-principal-input"
              type="number"
              value={bondPrincipal}
              onChange={(e) => setBondPrincipal(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.2rem' }}>Años de Bloqueo (1 - 5 años):</label>
            <select
              data-testid="bonds-years-select"
              value={bondLockYears}
              onChange={(e) => setBondLockYears(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
            >
              <option value="1">1 Año (Descuento ~10%)</option>
              <option value="2">2 Años (Descuento ~18%)</option>
              <option value="3">3 Años (Descuento ~26%)</option>
              <option value="4">4 Años (Descuento ~34%)</option>
              <option value="5">5 Años (Descuento Máximo 40%)</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
              <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>Dirección Referidor (Opcional - 1.5% Reward USDC):</label>
              {onOpenReferral && (
                <button
                  type="button"
                  onClick={onOpenReferral}
                  style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
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
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
            />
          </div>

          {/* Discount Summary Box */}
          <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.25)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>Descuento Calculado:</span>
              <strong data-testid="bonds-discount-badge" style={{ color: '#c084fc' }}>{discountPct}% OFF</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Precio a Pagar Hoy:</span>
              <strong data-testid="bonds-price-today" style={{ color: '#4ade80' }}>${discountedPrice} USDC</strong>
            </div>
          </div>

          <button data-testid="bonds-buy-btn" className="btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', marginTop: '0.2rem' }} onClick={onBuyBond}>
            💳 Comprar Bono Vestado & Mint NFT
          </button>
        </div>
      </div>

      {/* Position NFTs Gallery Card */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem' }}>🎨 Mis Posiciones ERC-721 ({userPositions.length})</h3>

        {userPositions.length === 0 ? (
          <div style={{ opacity: 0.5, textAlign: 'center', padding: '3rem 1rem', fontSize: '0.85rem' }}>
            No posees ninguna posición NFT de bono vestado activa.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '420px', overflowY: 'auto' }}>
            {userPositions.map((pos) => (
              <div
                key={pos.id}
                style={{
                  background: pos.isRagequitted || pos.isMaturedClaimed ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.04)',
                  border: pos.canClaim ? '1px solid rgba(74, 222, 128, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#c084fc', marginBottom: '0.2rem' }}>
                    Bono NFT #{pos.id} • {pos.lockYears} Años
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                    Principal: <strong>${pos.principal} USD</strong> | Pagado: ${pos.paid} USD
                  </div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.2rem' }}>
                    Vence: {pos.expDateStr}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {pos.isRagequitted && <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>Ragequitted</span>}
                  {pos.isMaturedClaimed && <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>Reclamado</span>}

                  {pos.canClaim && (
                    <button className="btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', background: '#22c55e' }} onClick={() => onClaimMatured(pos.id)}>
                      Reclamar
                    </button>
                  )}

                  {!pos.isRagequitted && !pos.isMaturedClaimed && (
                    <button className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', borderColor: '#ef4444', color: '#ef4444' }} onClick={() => onRagequit(pos.id)}>
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