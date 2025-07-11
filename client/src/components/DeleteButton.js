import React, { useState } from 'react'
import { deleteMessages } from '../services/fetch-chat.js';

export default function DeleteMessagesButton({ userId }) {
    const [hover, setHover] = useState(false);
    const [mouseDown, setMouseDown] = useState(false);
  
    const handleDelete = async () => {
      try {
        await deleteMessages(userId);
        window.location.reload();
      } catch (err) {
        console.error('Error deleting messages:', err);
      }
    };
  
    return (
      <button
        style={{
  
          marginRight: '1.5rem',
          fontSize: '.7em',
          padding: '0.14em 0.49em',
          borderRadius: '6px',
          background: mouseDown ? 'darkred' : hover ? 'red' : 'black',
          fontWeight: 'bold',
          color: '#fff',
          cursor: 'pointer',
          zIndex: 2,
          transition: 'background 0.1s',
        }}
        onClick={handleDelete}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => { setHover(false); setMouseDown(false); }}
        onMouseDown={() => setMouseDown(true)}
        onMouseUp={() => setMouseDown(false)}
      >
        Delete Messages
      </button>
    );
  }
