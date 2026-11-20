import { readFileSync } from 'fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (process.env.FIRESTORE_EMULATOR_HOST) {
  // local emulator only needs a project id
  initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-chat' });
} else if (keyPath) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
} else {
  initializeApp({ credential: applicationDefault() });
}

export const db = getFirestore();
