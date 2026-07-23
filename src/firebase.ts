import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDpzdHsuRZ6yElziVO6HBCzW33oS3_DgIc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'spyfall-6bd7a.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://spyfall-6bd7a-default-rtdb.asia-southeast1.firebasedatabase.app/',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'spyfall-6bd7a',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'spyfall-6bd7a.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '406017837152',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:406017837152:web:d89ade5398f922af6c5b05',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-3CKELG76XQ',
};

if (!firebaseConfig.databaseURL || !firebaseConfig.apiKey) {
  console.error('Missing Firebase config. Check .env file.');
}

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const authReady = new Promise((resolve) => {
  let resolved = false;
  const done = (user) => {
    if (!resolved) { resolved = true; resolve(user); }
  };

  // Listen continuously — resolves as soon as any sign-in succeeds,
  // even if the first attempt failed due to being offline.
  const unsub = onAuthStateChanged(auth, (user) => {
    if (user) { unsub(); done(user); }
  });

  const trySignIn = () => signInAnonymously(auth).catch(() => {});
  trySignIn();

  // Retry when network comes back (handles offline-at-startup case)
  window.addEventListener('online', trySignIn, { once: true });

  // Hard timeout — allow app to proceed even if auth never resolves
  setTimeout(() => done(null), 10000);
});

export { db, auth, authReady };
