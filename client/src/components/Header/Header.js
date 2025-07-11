import React from 'react';
import DeleteMessagesButton from '../DeleteButton/DeleteButton.js';

const Header = ({ userId }) => {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      background: '#181818',
      color: 'white',
      padding: '.5rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopLeftRadius: '0',
      borderTopRightRadius: '0',
      boxShadow: '0 2px 8px #0008',
      fontSize: '1.4rem', 
      fontWeight: 'bold',
      letterSpacing: '.15rem',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}>
        <span style={{fontSize:'1.05rem',userSelect:'none'}}>
          <img width="28px" style={{borderRadius:'25%'}} alt='logo' src="./logo.png"/>
        </span>
        <span style={{fontSize:'1.05rem',userSelect:'none'}}>My Coding Assistant</span>
      </div>
      <DeleteMessagesButton userId={userId} />
    </header>
  );
};

export default Header; 