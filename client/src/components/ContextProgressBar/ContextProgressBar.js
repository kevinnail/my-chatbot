import React from 'react';

const ContextProgressBar = ({ contextPercent = 0 }) => {
  const safeContextPercent = contextPercent || 0;

  return (
    <div
      style={{
        width: '90%',
        margin: '1.5rem auto 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexDirection: 'row',
        justifyContent: 'flex-start',
      }}
    >
      <div
        style={{
          width: '154px',
          height: '20px',
          background: '#222',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '2px solid #444',
          position: 'relative',
          boxShadow: '0 1px 6px #0006',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, safeContextPercent).toFixed(1)}%`,
            height: '100%',
            background:
              safeContextPercent < 70
                ? 'linear-gradient(90deg,#4af,#0fa)'
                : safeContextPercent < 90
                  ? 'linear-gradient(90deg,#ff0,#fa0)'
                  : 'linear-gradient(90deg,#f44,#a00)',
            transition: 'width 0.5s cubic-bezier(.4,2,.6,1)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            textShadow: '0 1px 4px #000a',
            pointerEvents: 'none',
          }}
        >
          {safeContextPercent.toFixed(1)}% context used{' '}
        </span>
      </div>
      <span
        style={{
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '0.85rem',
          textShadow: '0 1px 4px #000a',
          pointerEvents: 'none',
        }}
      >
        ~{(128000 * (1 - safeContextPercent / 100)).toFixed(0)} tokens left{' '}
      </span>
    </div>
  );
};

export default ContextProgressBar;
