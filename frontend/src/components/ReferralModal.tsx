import React, { useState } from 'react';
import styles from './ReferralModal.module.css';
import { UI_STRINGS } from '../constants/strings.js';

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
  
  const shareText = UI_STRINGS.MODALS.REFERRAL.SHARE_TEXT;

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
            {UI_STRINGS.MODALS.REFERRAL.TITLE}
          </h2>
          <p className={styles.subtitle}>
            {UI_STRINGS.MODALS.REFERRAL.SUBTITLE}
          </p>
        </div>

        {/* Benefits Card */}
        <div className={styles.benefitsCard}>
          <h4 className={styles.benefitsH4}>
            <span>💎</span> {UI_STRINGS.MODALS.REFERRAL.BENEFITS_TITLE}
          </h4>
          <ul className={styles.benefitsUl}>
            <li>{UI_STRINGS.MODALS.REFERRAL.BENEFIT_1_TEXT}</li>
            <li>{UI_STRINGS.MODALS.REFERRAL.BENEFIT_2_TEXT}</li>
            <li>{UI_STRINGS.MODALS.REFERRAL.BENEFIT_3_TEXT}</li>
          </ul>
        </div>

        {/* Link Input Section */}
        <div className="margin-bottom-lg">
          <label className="acp-label-sm font-semibold margin-bottom-xs">
            {UI_STRINGS.MODALS.REFERRAL.LINK_LABEL}
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
              {copied ? UI_STRINGS.MODALS.REFERRAL.BTN_COPIED : UI_STRINGS.MODALS.REFERRAL.BTN_COPY}
            </button>
          </div>
        </div>

        {/* Social Share Buttons */}
        <div>
          <label className="acp-label-sm font-semibold text-center margin-bottom-sm">
            {UI_STRINGS.MODALS.REFERRAL.SOCIAL_SHARE_TITLE}
          </label>
          <div className={styles.socialGrid}>
            <button
              onClick={shareTwitter}
              className={`${styles.socialBtn} ${styles.socialTwitter}`}
            >
              {UI_STRINGS.MODALS.REFERRAL.BTN_TWITTER}
            </button>

            <button
              onClick={shareTelegram}
              className={`${styles.socialBtn} ${styles.socialTelegram}`}
            >
              {UI_STRINGS.MODALS.REFERRAL.BTN_TELEGRAM}
            </button>

            <button
              onClick={shareWhatsapp}
              className={`${styles.socialBtn} ${styles.socialWhatsapp}`}
            >
              {UI_STRINGS.MODALS.REFERRAL.BTN_WHATSAPP}
            </button>

            <button
              onClick={shareLinkedin}
              className={`${styles.socialBtn} ${styles.socialLinkedin}`}
            >
              {UI_STRINGS.MODALS.REFERRAL.BTN_LINKEDIN}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
