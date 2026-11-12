import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  updatePassword as firebaseUpdatePassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, Role, UserStatus } from '../types';
import { logOperation } from '../lib/logger';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  loginProvider: () => Promise<void>;
  loginEmail: (e: string, p: string) => Promise<void>;
  loginWithName: (username: string, p: string) => Promise<void>;
  registerEmail: (e: string, p: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserPassword: (newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const provider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          let userDoc;
          try {
            userDoc = await getDoc(userDocRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, 'users/' + user.uid);
            return;
          }
          
          if (userDoc.exists()) {
            setUserData({ id: userDoc.id, ...userDoc.data() } as User);
          } else {
            // Self-register
            const isBootstrapAdmin = user.email === 'dennisbottari@gmail.com';
            const newUser = {
              email: user.email!,
              role: (isBootstrapAdmin ? 'admin' : 'utente') as Role,
              status: (isBootstrapAdmin ? 'approved' : 'pending') as UserStatus,
              createdAt: serverTimestamp()
            };
            try {
              await setDoc(userDocRef, newUser);
              setUserData({ id: user.uid, ...newUser } as User);
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, 'users/' + user.uid);
            }
          }
        } catch (error) {
          console.error("General auth error", error);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginProvider = async () => {
    const cred = await signInWithPopup(auth, provider);
    await logOperation('login', 'system', `Login tramite provider ${cred.user.email}`, cred.user.uid, cred.user.email || '');
  };
  
  const loginEmail = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await logOperation('login', 'system', `Login con email ${cred.user.email}`, cred.user.uid, cred.user.email || '');
  };

  const loginWithName = async (username: string, pass: string) => {
    try {
      const nameId = username.trim().toLowerCase();
      const lookupRef = doc(db, 'public_lookup', nameId);
      const lookupSnap = await getDoc(lookupRef);
      
      if (!lookupSnap.exists()) {
        throw new Error('Utente non trovato con questo nome utente.');
      }
      
      const { email } = lookupSnap.data();
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      await logOperation('login', 'system', `Login tramite username ${username}`, cred.user.uid, cred.user.email || '');
    } catch (err: any) {
      if (err.message.includes('auth/invalid-credential')) {
        throw new Error('Password errata.');
      }
      throw err;
    }
  };

  const registerEmail = async (email: string, pass: string, firstName?: string, lastName?: string) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    const userDocRef = doc(db, 'users', user.uid);
    const userData = {
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      role: 'utente' as Role,
      status: 'pending' as UserStatus,
      createdAt: serverTimestamp()
    };
    
    await setDoc(userDocRef, userData);

    const username = email.split('@')[0].toLowerCase();
    await setDoc(doc(db, 'public_lookup', username), { email });

    await logOperation('create', 'users', `Registrazione nuovo utente: ${email}`, user.uid, user.email || '', user.uid);
  };

  const logout = () => signOut(auth);

  const updateUserPassword = async (newPass: string) => {
    if (!auth.currentUser) return;
    await firebaseUpdatePassword(auth.currentUser, newPass);
    // Update the mustChangePassword flag in Firestore
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    await setDoc(userDocRef, { mustChangePassword: false }, { merge: true });
    // Update local state
    if (userData) setUserData({ ...userData, mustChangePassword: false });
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      userData, 
      loading, 
      loginProvider, 
      loginEmail, 
      loginWithName,
      registerEmail, 
      logout,
      updateUserPassword
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
