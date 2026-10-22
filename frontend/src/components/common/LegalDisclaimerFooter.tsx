import React, { useState } from 'react';
import styles from './LegalDisclaimerFooter.module.css';

interface LegalDisclaimerFooterProps {
  chainId?: number;
}

export const LegalDisclaimerFooter: React.FC<LegalDisclaimerFooterProps> = ({ chainId }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.topRow}>
          <div className={styles.badges}>
            <span className={styles.badge}>
              <span className={styles.badgeDot} />
              Pure DeFi • MiCA Recital 22 Exemption
            </span>
            <span className={styles.badge}>
              <span className={styles.badgeDot} />
              IPFS / ENS Decentralized Gateway
            </span>
            <span className={styles.badge}>
              <span className={styles.badgeDot} />
              Chain ID: {chainId || 31337}
            </span>
          </div>
          <div className={styles.links}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setIsModalOpen(true)}
            >
              Marco Legal & Advertencias de Riesgo
            </button>
          </div>
        </div>

        <p className={styles.disclaimerText}>
          Alpha Centauri es una infraestructura de contratos inteligentes autónomos, no custodiales y de código abierto.
          No existen entidades intermediarias, figuras corporativas ni llaves maestras individuales. El Valor Patrimonial
          Neto (NAV) y las cuotas de rendimiento se determinan exclusivamente mediante la actividad on-chain y los colaterales exógenos (USDC, WBTC, WETH).
        </p>

        <div className={styles.bottomRow}>
          <span>© 2026 Alpha Centauri DAO. Public Good Autonomous Protocol.</span>
          <span>Build Integrity: Verified SHA-256 Manifest • Resolution: alphacentauri.eth</span>
        </div>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                🛡️ Marco Regulatorio y Avisos Legales
              </h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalSection}>
              <h4>1. Exención de Descentralización Plena (Reglamento UE 2023/1114 - MiCA)</h4>
              <p>
                De acuerdo con el Considerando 22 del Reglamento MiCA de la Unión Europea, los servicios de criptoactivos prestados
                de manera totalmente descentralizada sin intermediarios quedan excluidos del ámbito de aplicación del reglamento.
                Alpha Centauri no cobra comisiones de gestión corporativa; el 100% de las comisiones generadas se reparte algorítmicamente
                en un 50% para fortalecimiento de reservas (accretion) y un 50% para dividendos de stakers comunitarios.
              </p>
            </div>

            <div className={styles.modalSection}>
              <h4>2. Carácter Flotante del NAV y No Promisión de Rendimiento</h4>
              <p>
                El token ALPHA representa una cuota proporcional sobre la cesta de activos exógenos reales custodiados en los smart contracts.
                El NAV fluctúa en tiempo real según la cotización de los colaterales (USDC, WBTC, WETH) auditados por Chainlink.
                Ningún porcentaje o APY estimado mostrado en la interfaz constituye una garantía de rentabilidad financiera ni un depósito bancario.
              </p>
            </div>

            <div className={styles.modalSection}>
              <h4>3. Deslinde del Mercado Peer-to-Peer (P2P)</h4>
              <p>
                El mercado P2P monetario facilita la conexión directa entre billeteras mediante contratos inteligentes de depósito en custodia (escrow).
                El protocolo no actúa como prestamista ni garantiza el repago de los créditos bilaterales acordados entre usuarios.
              </p>
            </div>

            <div className={styles.modalSection}>
              <h4>4. Gobernanza Descentralizada & Timelock de 72 Horas</h4>
              <p>
                Cualquier actualización de parámetros o contratos requiere la aprobación mayoritaria de los tenedores de stALPHA a través
                de la DAO y está sujeta a un retraso de seguridad inmutable de 72 horas gestionado por TimelockController.sol.
              </p>
            </div>

            <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
              <button
                type="button"
                className={styles.closeBtn}
                style={{ background: '#0284c7', color: '#fff', padding: '0.5rem 1rem', fontWeight: 500 }}
                onClick={() => setIsModalOpen(false)}
              >
                Entendido y Aceptado
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
