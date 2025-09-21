import React, { useState } from 'react';
import { deleteMessages } from '../../services/fetch-chat.js';
import { useChatContext } from '../../contexts/ChatContext';
import ConfirmationDialog from '../ConfirmationDialog/ConfirmationDialog';

export default function DeleteMessagesButton({ userId, loading, setMobileMenuOpen }) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { setContextPercent, setLog } = useChatContext();
  const { setChats } = useChatContext();

  const handleDeleteClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = async () => {
    setShowConfirmDialog(false);
    setMobileMenuOpen(false);
    try {
      setLog([]);
      setContextPercent(0);
      setChats([]);
      await deleteMessages(userId);
    } catch (err) {
      console.error('Error deleting messages:', err);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmDialog(false);
  };

  return (
    <>
      <button disabled={loading} className="menu-item delete-item" onClick={handleDeleteClick}>
        Delete ALL Messages
      </button>

      <ConfirmationDialog
        isOpen={showConfirmDialog}
        title="Delete All Messages"
        message="This will permanently delete ALL your messages and chat history. This action cannot be undone. Are you sure you want to continue?"
        confirmText="Yes, Delete Everything"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        confirmButtonStyle={{
          background: 'darkred',
          color: 'white',
        }}
      />
    </>
  );
}
