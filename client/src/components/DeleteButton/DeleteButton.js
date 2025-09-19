import React, { useState } from 'react';
import { deleteMessages } from '../../services/fetch-chat.js';
import { useChatContext } from '../../contexts/ChatContext';
import ConfirmationDialog from '../ConfirmationDialog/ConfirmationDialog';

export default function DeleteMessagesButton({ userId, loading, setMobileMenuOpen }) {
  const [hover, setHover] = useState(false);
  const [mouseDown, setMouseDown] = useState(false);
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
      <button
        disabled={loading}
        style={{
          fontSize: '.7em',
          padding: '.5rem 1rem',
          borderRadius: '6px',
          background: mouseDown ? 'darkred' : hover ? 'red' : '#222',
          fontWeight: 'bold',
          color: '#fff',
          cursor: 'pointer',
          zIndex: 2,
          transition: 'background 0.1s',
          width: '100%',
        }}
        onClick={handleDeleteClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => {
          setHover(false);
          setMouseDown(false);
        }}
        onMouseDown={() => setMouseDown(true)}
        onMouseUp={() => setMouseDown(false)}
      >
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
