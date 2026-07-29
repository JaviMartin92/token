import React, { useState } from 'react';

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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '540px',
        width: '100%',
        borderRadius: '20px',
        border: '1px solid rgba(168, 85, 247, 0.4)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(168, 85, 247, 0.2)',
        padding: '2rem',
        position: 'relative',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#fff',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎁</div>
          <h2 style={{
            margin: 0,
            fontSize: '1.6rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #a855f7 0%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Programa de Referidos Autosostenible
          </h2>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.88rem', opacity: 0.75 }}>
            Invita a tus amigos a Alpha Centauri V6 y gana comisiones automáticas en USDC por cada transacción.
          </p>
        </div>

        {/* Benefits Card */}
        <div style={{
          background: 'rgba(168, 85, 247, 0.08)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: '14px',
          padding: '1.2rem',
          marginBottom: '1.5rem'
        }}>
          <h4 style={{ margin: '0 0 0.8rem 0', color: '#c084fc', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>💎</span> Beneficios Exclusivos del Programa:
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', lineHeight: '1.6', opacity: 0.9 }}>
            <li><strong style={{ color: '#4ade80' }}>1.5% de Comisión Directa en USDC</strong> transferidos a tu wallet por cada amigo que compre un Bono.</li>
            <li><strong style={{ color: '#38bdf8' }}>Hasta 20% de Descuento</strong> para tus invitados en la compra de sus Bonos Vestados.</li>
            <li><strong style={{ color: '#fbbf24' }}>Pago Instantáneo On-Chain</strong> sin intermediarios ni periodos de espera.</li>
          </ul>
        </div>

        {/* Link Input Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.4rem', fontWeight: 600 }}>
            TU ENLACE ÚNICO DE REFERIDO:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              readOnly
              value={referralLink}
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#38bdf8',
                padding: '0.7rem 0.9rem',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontFamily: 'monospace'
              }}
            />
            <button
              onClick={handleCopy}
              style={{
                background: copied ? '#22c55e' : 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                color: '#fff',
                border: 'none',
                padding: '0.7rem 1.2rem',
                borderRadius: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {copied ? '✓ ¡Copiado!' : '📋 Copiar'}
            </button>
          </div>
        </div>

        {/* Social Share Buttons */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.6rem', fontWeight: 600, textAlign: 'center' }}>
            COMPARTIR DIRECTAMENTE EN REDES SOCIALES:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
            <button
              onClick={shareTwitter}
              style={{
                background: 'rgba(29, 161, 242, 0.15)',
                border: '1px solid rgba(29, 161, 242, 0.4)',
                color: '#1da1f2',
                padding: '0.6rem',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem'
              }}
            >
              🐦 X / Twitter
            </button>

            <button
              onClick={shareTelegram}
              style={{
                background: 'rgba(0, 136, 204, 0.15)',
                border: '1px solid rgba(0, 136, 204, 0.4)',
                color: '#0088cc',
                padding: '0.6rem',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem'
              }}
            >
              💬 Telegram
            </button>

            <button
              onClick={shareWhatsapp}
              style={{
                background: 'rgba(37, 211, 102, 0.15)',
                border: '1px solid rgba(37, 211, 102, 0.4)',
                color: '#25d366',
                padding: '0.6rem',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem'
              }}
            >
              📱 WhatsApp
            </button>

            <button
              onClick={shareLinkedin}
              style={{
                background: 'rgba(10, 102, 194, 0.15)',
                border: '1px solid rgba(10, 102, 194, 0.4)',
                color: '#0a66c2',
                padding: '0.6rem',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem'
              }}
            >
              💼 LinkedIn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
