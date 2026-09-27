import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseConfigJson from '../../firebase-applet-config.json';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let isConfigured = false;

try {
  if (firebaseConfigJson && firebaseConfigJson.projectId && firebaseConfigJson.apiKey) {
    const firebaseConfig = {
      apiKey: firebaseConfigJson.apiKey,
      authDomain: firebaseConfigJson.authDomain,
      projectId: firebaseConfigJson.projectId,
      storageBucket: firebaseConfigJson.storageBucket,
      messagingSenderId: firebaseConfigJson.messagingSenderId,
      appId: firebaseConfigJson.appId,
    };

    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    
    // Connect to named database with defensive settings (ignoreUndefinedProperties: true)
    const databaseId = firebaseConfigJson.firestoreDatabaseId;
    try {
      if (databaseId && databaseId !== '(default)') {
        db = initializeFirestore(app, { ignoreUndefinedProperties: true }, databaseId);
      } else {
        db = initializeFirestore(app, { ignoreUndefinedProperties: true });
      }
    } catch {
      // In case initializeFirestore was already called on this app instance
      db = databaseId && databaseId !== '(default)' ? getFirestore(app, databaseId) : getFirestore(app);
    }

    storage = getStorage(app);
    isConfigured = true;
  }
} catch (error) {
  console.warn('Firebase initialization notice:', error);
  isConfigured = false;
}

export { app, auth, db, storage, isConfigured };
