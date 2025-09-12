import React from 'react';
import './ConfirmationDialog.css';

export default function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  confirmButtonStyle = {},
  variant = 'default', // 'default' or 'subtle'
}) {
  if (!isOpen) return null;

  return (
    <div className="confirmation-overlay">
      <div
        className={`confirmation-dialog ${variant === 'subtle' ? 'confirmation-dialog-subtle' : ''}`}
      >
        <h3 className="confirmation-title">{title}</h3>
        <p className="confirmation-message">{message}</p>
        <div className="confirmation-buttons">
          <button className="confirmation-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="confirmation-confirm" onClick={onConfirm} style={confirmButtonStyle}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
