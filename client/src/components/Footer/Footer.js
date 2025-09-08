import React from 'react';

const Footer = () => {
  return (
    <footer
      style={{
        background: '#181818',
        color: '#aaa',
        padding: '1rem 0',
        textAlign: 'center',
        fontSize: '0.77rem',
        borderBottomLeftRadius: '0',
        borderBottomRightRadius: '0',
        boxShadow: '0 -2px 8px #0008',
        marginTop: '2rem',
        bottom: '0',
        position: 'fixed',
        width: '100%',
        zIndex: '1000',
      }}
    >
      <div>
        Powered by React/ Express/ Node/ WSL •{' '}
        <span style={{ fontFamily: 'monospace' }}>My Coding Assistant</span> &copy;{' '}
        {new Date().getFullYear()}
      </div>
      <div style={{ fontSize: '0.67rem', marginTop: '0.3em' }}>
        <a
          href="https://github.com/kevinnail/my-chatbot"
          target="_blank"
          rel="noreferrer"
          style={{ color: '#4af', textDecoration: 'underline' }}
        >
          GitHub
        </a>
      </div>
    </footer>
  );
};

export default Footer;
