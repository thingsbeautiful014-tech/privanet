import { useState, useEffect, createContext, useContext } from 'react';
import { auth, db, googleProvider } from '../lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { generateKeyPair, exportKey, savePrivateKey, getPrivateKey } from '../lib/crypto';

interface UserProfile {
  uid: string;
  pseudonym: string;
  bio?: string;
  headline?: string;
  bannerGradient?: string;
  avatarUrl?: string;
  publicKey?: string;
  createdAt?: any;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  isNewUser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
          setIsNewUser(false);
        } else {
          setIsNewUser(true);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in error", error);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);
    
    let finalData = { ...data };
    
    // If it's a new profile, generate E2EE keys
    if (!docSnap.exists() && data.pseudonym) {
      const keys = await generateKeyPair();
      const publicKeyStr = await exportKey(keys.publicKey);
      await savePrivateKey(user.uid, keys.privateKey);
      
      finalData = {
        ...finalData,
        uid: user.uid,
        publicKey: publicKeyStr,
        createdAt: serverTimestamp() as any,
      };
      
      await setDoc(docRef, finalData);
      setProfile(finalData as UserProfile);
      setIsNewUser(false);
    } else {
      await setDoc(docRef, data, { merge: true });
      const updatedSnap = await getDoc(docRef);
      setProfile(updatedSnap.data() as UserProfile);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut: handleSignOut, updateProfile, isNewUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
