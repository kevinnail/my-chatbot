import React, { useState } from 'react';
import { deleteMessages } from '../../services/fetch-chat.js';
import { useChatContext } from '../../contexts/ChatContext';

export default function DeleteMessagesButton({ userId, loading, setMobileMenuOpen }) {
  const [hover, setHover] = useState(false);
  const [mouseDown, setMouseDown] = useState(false);
  const { setContextPercent, setLog } = useChatContext();

  const handleDelete = async () => {
    setMobileMenuOpen(false);

    try {
      setLog([]);
      setContextPercent(0);

      await deleteMessages(userId);
    } catch (err) {
      console.error('Error deleting messages:', err);
    }
  };

  return (
    <button
      disabled={loading}
      style={{
        fontSize: '.7em',
        padding: '0.14em 0.49em',
        borderRadius: '6px',
        background: mouseDown ? 'darkred' : hover ? 'red' : 'black',
        fontWeight: 'bold',
        color: '#fff',
        cursor: 'pointer',
        zIndex: 2,
        transition: 'background 0.1s',
        border: '2px solid red',
      }}
      onClick={handleDelete}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setMouseDown(false);
      }}
      onMouseDown={() => setMouseDown(true)}
      onMouseUp={() => setMouseDown(false)}
    >
      Delete Messages
    </button>
  );
}
