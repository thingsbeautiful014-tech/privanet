import { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, limit, or, and } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { encrypt, decrypt, importKey, getPrivateKey } from '../lib/crypto';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Lock, User as UserIcon, ChevronLeft, Search } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string; // Encrypted
  createdAt: any;
  decryptedContent?: string;
}

interface ChatUser {
  uid: string;
  pseudonym: string;
  publicKey: string;
}

export function Chat() {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch users to start chat
  useEffect(() => {
    const fetchUsers = async () => {
      const q = query(collection(db, 'users'), limit(50));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs
        .map(doc => doc.data() as ChatUser)
        .filter(u => u.uid !== user?.uid);
      setUsers(usersData);
    };
    fetchUsers();
  }, [user]);

  // Real-time messages
  useEffect(() => {
    if (!selectedUser || !user) return;

    const q = query(
      collection(db, 'messages'),
      where('senderId', 'in', [user.uid, selectedUser.uid]),
      where('receiverId', 'in', [user.uid, selectedUser.uid]),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const rawMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      
      // Decrypt messages
      const privateKey = await getPrivateKey(user.uid);
      if (!privateKey) {
        setMessages(rawMessages.map(m => ({ ...m, decryptedContent: '[Erreur de clé de déchiffrement]' })));
        return;
      }

      const decryptedMessages = await Promise.all(rawMessages.map(async (m: any) => {
        try {
          if (m.receiverId === user.uid) {
            const dec = await decrypt(m.content, privateKey);
            return { ...m, decryptedContent: dec };
          } else if (m.senderId === user.uid) {
            if (m.senderContent) {
              const dec = await decrypt(m.senderContent, privateKey);
              return { ...m, decryptedContent: dec };
            }
            return { ...m, decryptedContent: m.plainPreview || '[Message Chiffré Sécurisé]' };
          }
          return { ...m, decryptedContent: '[Accès non autorisé]' };
        } catch {
          return { ...m, decryptedContent: '[Déchiffrement sécurisé en cours...]' };
        }
      }));

      setMessages(decryptedMessages);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsubscribe();
  }, [selectedUser, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !user) return;

    const messageText = newMessage.trim();
    setLoading(true);
    try {
      const receiverPubKey = await importKey(selectedUser.publicKey, 'public');
      const encryptedContent = await encrypt(messageText, receiverPubKey);

      let senderEncryptedContent: string | null = null;
      if (profile?.publicKey) {
        const senderPubKey = await importKey(profile.publicKey, 'public');
        senderEncryptedContent = await encrypt(messageText, senderPubKey);
      }

      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        receiverId: selectedUser.uid,
        content: encryptedContent,
        senderContent: senderEncryptedContent,
        createdAt: serverTimestamp(),
      });

      // Notify the receiver
      await addDoc(collection(db, 'notifications'), {
        userId: selectedUser.uid,
        type: 'message',
        fromUserId: user.uid,
        fromPseudonym: profile?.pseudonym || 'Utilisateur',
        createdAt: serverTimestamp(),
        read: false,
      });

      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.pseudonym.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!selectedUser) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-[calc(100vh-10rem)] md:h-[calc(100vh-6rem)] flex flex-col bg-white border border-zinc-100 rounded-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-100">
          <h2 className="text-xl font-display font-bold text-zinc-900 mb-4">Messages Sécurisés</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un pseudonyme..." 
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/5 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400">
              <UserIcon size={48} className="mb-4 opacity-20" />
              <p className="text-sm">Aucun utilisateur trouvé</p>
            </div>
          ) : (
            filteredUsers.map((u) => (
              <button
                key={u.uid}
                onClick={() => setSelectedUser(u)}
                className="w-full flex items-center gap-4 p-4 hover:bg-zinc-50 rounded-xl transition-all text-left group"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-zinc-500 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                  {u.pseudonym[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-zinc-900">{u.pseudonym}</h3>
                  <p className="text-xs text-zinc-400 flex items-center gap-1">
                    <Lock size={10} /> Chiffrement de bout en bout
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-[calc(100vh-10rem)] md:h-[calc(100vh-6rem)] flex flex-col bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-lg"
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-100 flex items-center gap-4 bg-white sticky top-0 z-10">
        <button 
          onClick={() => setSelectedUser(null)} 
          className="btn-icon-press p-2 hover:bg-zinc-50 rounded-xl transition-colors text-zinc-400 hover:text-zinc-900"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white text-sm font-bold shadow-sm">
          {selectedUser.pseudonym[0].toUpperCase()}
        </div>
        <div>
          <h3 className="font-bold text-zinc-900 text-sm">{selectedUser.pseudonym}</h3>
          <p className="text-[10px] text-pink-600 font-bold uppercase tracking-widest flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" /> E2EE Chiffré
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/30">
        {messages.map((m) => (
          <div 
            key={m.id} 
            className={`flex ${m.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-4 rounded-2xl text-sm shadow-sm ${
              m.senderId === user?.uid 
                ? 'bg-gradient-to-tr from-purple-600 via-pink-600 to-rose-500 text-white rounded-br-none shadow-md' 
                : 'bg-white text-zinc-800 border border-zinc-200/80 rounded-bl-none'
            }`}>
              <p className="leading-relaxed whitespace-pre-wrap">{m.decryptedContent}</p>
              <p className={`text-[10px] mt-1.5 text-right ${m.senderId === user?.uid ? 'text-white/70' : 'text-zinc-400'}`}>
                {m.createdAt ? format(m.createdAt.toDate(), 'HH:mm', { locale: fr }) : ''}
              </p>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-zinc-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Écrire un message chiffré de bout en bout..."
            className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm text-zinc-900"
          />
          <button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="btn-icon-press p-3 bg-gradient-to-tr from-purple-600 to-pink-600 text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-40 shadow-md"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </motion.div>
  );
}
