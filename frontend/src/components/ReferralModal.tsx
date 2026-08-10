import React, { useState } from 'react';
import styles from './ReferralModal.module.css';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
  onCopySuccess: () => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({
  isOpen,
  onClose,
  userAddress,
  onCopySuccess
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const referralLink = `${window.location.origin}/?ref=${userAddress || '0x0000000000000000000000000000000000000000'}`;
  
  const shareText = `🚀 Unete a Alpha Centauri V6 y obtén hasta un 20% de descuento en Bonos Vestados respaldados por Proof of Reserves. ¡Invierte con auto-custodia on-chain!`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    onCopySuccess();
    setTimeout(() => setCopied(false), 3000);
  };

  const shareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(referralLink)}`;
    window.open(url, '_blank');
  };

  const shareTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const shareWhatsapp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${referralLink}`)}`;
    window.open(url, '_blank');
  };

  const shareLinkedin = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-container">
        {/* Close Button */}
        <button
          data-testid="referral-modal-close-btn"
          onClick={onClose}
          className={styles.closeBtn}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className={styles.header}>
          <div className={styles.icon}>🎁</div>
          <h2 className={styles.title}>
            Programa de Referidos Autosostenible
          </h2>
          <p className={styles.subtitle}>
            Invita a tus amigos a Alpha Centauri V6 y gana comisiones automáticas en USDC por cada transacción.
          </p>
        </div>

        {/* Benefits Card */}
        <div className={styles.benefitsCard}>
          <h4 className={styles.benefitsH4}>
            <span>💎</span> Beneficios Exclusivos del Programa:
          </h4>
          <ul className={styles.benefitsUl}>
            <li><strong className="text-green-bright">1.5% de Comisión Directa en USDC</strong> transferidos a tu wallet por cada amigo que compre un Bono.</li>
            <li><strong className="text-cyan">Hasta 20% de Descuento</strong> para tus invitados en la compra de sus Bonos Vestados.</li>
            <li><strong className="text-pink-light">Sin Límites de Ingresos</strong>: Gana comisiones recurrentes por cada referido activo.</li>
          </ul>
        </div>

        {/* Link Input Section */}
        <div className="margin-bottom-lg">
          <label className="acp-label-sm font-semibold margin-bottom-xs">
            TU ENLACE ÚNICO DE REFERIDO:
          </label>
          <div className="acp-flex-row-gap5">
            <input
              data-testid="referral-link-input"
              type="text"
              readOnly
              value={referralLink}
              className={styles.linkInput}
            />
            <button
              data-testid="referral-copy-btn"
              onClick={handleCopy}
              className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : styles.copyBtnNormal}`}
            >
              {copied ? '✓ ¡Copiado!' : '📋 Copiar'}
            </button>
          </div>
        </div>

        {/* Social Share Buttons */}
        <div>
          <label className="acp-label-sm font-semibold text-center margin-bottom-sm">
            COMPARTIR DIRECTAMENTE EN REDES SOCIALES:
          </label>
          <div className={styles.socialGrid}>
            <button
              onClick={shareTwitter}
              className={`${styles.socialBtn} ${styles.socialTwitter}`}
            >
              🐦 X / Twitter
            </button>

            <button
              onClick={shareTelegram}
              className={`${styles.socialBtn} ${styles.socialTelegram}`}
            >
              💬 Telegram
            </button>

            <button
              onClick={shareWhatsapp}
              className={`${styles.socialBtn} ${styles.socialWhatsapp}`}
            >
              📱 WhatsApp
            </button>

            <button
              onClick={shareLinkedin}
              className={`${styles.socialBtn} ${styles.socialLinkedin}`}
            >
              💼 LinkedIn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
