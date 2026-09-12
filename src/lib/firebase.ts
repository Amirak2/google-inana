import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

export const PRIMARY_ADMIN_EMAIL = 'amirbiashad@gmail.com';

export const checkIsAdmin = (email?: string | null, role?: string | null): boolean => {
  if (!email && !role) return false;
  if (email && email.toLowerCase().trim() === PRIMARY_ADMIN_EMAIL.toLowerCase().trim()) return true;
  if (role === 'admin') return true;
  return false;
};
