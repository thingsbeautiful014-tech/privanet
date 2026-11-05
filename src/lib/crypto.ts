/**
 * E2EE Utilities using Web Crypto API
 */

export async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportKey(key: CryptoKey) {
  const exported = await window.crypto.subtle.exportKey(
    key.type === "public" ? "spki" : "pkcs8",
    key
  );
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importKey(keyData: string, type: "public" | "private") {
  const binaryDerString = atob(keyData);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return await window.crypto.subtle.importKey(
    type === "public" ? "spki" : "pkcs8",
    binaryDer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    type === "public" ? ["encrypt"] : ["decrypt"]
  );
}

export async function encrypt(data: string, publicKey: CryptoKey) {
  const encoded = new TextEncoder().encode(data);
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicKey,
    encoded
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

export async function decrypt(encryptedData: string, privateKey: CryptoKey) {
  const binaryString = atob(encryptedData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    privateKey,
    bytes
  );
  return new TextDecoder().decode(decrypted);
}

// Store private key in IndexedDB for persistence (more secure than LocalStorage)
const DB_NAME = 'PrivaNetKeys';
const STORE_NAME = 'keys';

export async function savePrivateKey(userId: string, privateKey: CryptoKey) {
  const request = indexedDB.open(DB_NAME, 1);
  return new Promise((resolve, reject) => {
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(privateKey, userId);
      tx.oncomplete = () => resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPrivateKey(userId: string): Promise<CryptoKey | null> {
  const request = indexedDB.open(DB_NAME, 1);
  return new Promise((resolve, reject) => {
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readonly');
      const getReq = tx.objectStore(STORE_NAME).get(userId);
      getReq.onsuccess = () => resolve(getReq.result || null);
    };
    request.onerror = () => reject(request.error);
  });
}
