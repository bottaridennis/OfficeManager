import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { SystemLog } from '../types';

export const logOperation = async (
  action: SystemLog['action'],
  collectionName: SystemLog['collection'],
  description: string,
  userId: string,
  userEmail: string,
  targetId?: string
) => {
  try {
    const logRef = doc(collection(db, 'logs'));
    const logData = {
      action,
      collection: collectionName,
      targetId: targetId || null,
      description,
      userId,
      userEmail,
      createdAt: serverTimestamp()
    };
    await setDoc(logRef, logData);
  } catch (error) {
    console.error("Failed to write log", error);
    // Non blocchiamo l'applicazione se fallisce un log, ma mostriamo un avviso in console
  }
};
