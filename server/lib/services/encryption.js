import 'dotenv/config';
import CryptoJS from 'crypto-js';

function encrypt(text) {
  if (text === null) {
    return null;
  }
  if (text === '') {
    // Encrypt empty string as empty encrypted string to satisfy not-null constraint
    const encrypted = CryptoJS.AES.encrypt('', process.env.ENCRYPTION_KEY);
    return encrypted.toString();
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
    const decrypted = CryptoJS.AES.decrypt(data, process.env.ENCRYPTION_KEY).toString(
      CryptoJS.enc.Utf8,
    );
    return decrypted.length > 0;
  } catch (e) {
    console.error('NOT ENCRYPTED:', e.message);
    return false;
  }
}

export { encrypt, decrypt, isEncrypted };
