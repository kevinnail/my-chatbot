require('dotenv').config();
const CryptoJS = require('crypto-js/core');
require('crypto-js/aes');

function encrypt(text) {
  if (text === null || text === '') {
    return null;
  }
  const encrypted = CryptoJS.AES.encrypt(text, process.env.ENCRYPTION_KEY);
  return encrypted.toString();
}

function decrypt(ciphertext) {
  if (!ciphertext) {
    // checks for both null and empty string
    return null;
  }

  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, process.env.ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (decrypted === '') {
      throw new Error('Decryption resulted in an empty string');
    }
    return decrypted;
  } catch (e) {
    console.error('Error during decryption:', e.message);
    return null;
  }
}

function isEncrypted(data) {
  try {
    const decrypted = CryptoJS.AES.decrypt(
      data,
      process.env.ENCRYPTION_KEY
    ).toString(CryptoJS.enc.Utf8);
    return decrypted.length > 0;
  } catch (e) {
    console.error('NOT ENCRYPTED:', e.message);
    return false;
  }
}

module.exports = { encrypt, decrypt, isEncrypted };
