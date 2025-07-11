import React, { useState } from 'react'

export default function CopyButton({ onClick }) {
    const [hover, setHover] = useState(false);
    const [mouseDown, setMouseDown] = useState(false);
  
    return (
      <button
        style={{
          position: 'absolute',
          top: 5,
          right: 5,
          fontSize: '.8em',
          padding: '0.14em 0.49em',
          borderRadius: '6px',
          background: mouseDown ? '#111' : hover ? '#222' : '#444',
          color: '#fff',
          cursor: 'pointer',
          zIndex: 2,
          transition: 'background 0.1s',
        }}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => { setHover(false); setMouseDown(false); }}
        onMouseDown={() => setMouseDown(true)}
        onMouseUp={() => setMouseDown(false)}
      >
        Copy
      </button>
    );
  }