import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, MessageSquare, Repeat, Heart, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'repost' | 'message' | 'mention';
  fromUserId: string;
  fromPseudonym: string;
  postId?: string;
  createdAt: any;
  read: boolean;
}

export function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={14} className="text-red-500" />;
      case 'repost': return <Repeat size={14} className="text-zinc-500" />;
      case 'message': return <MessageSquare size={14} className="text-blue-500" />;
      default: return <Bell size={14} className="text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-display font-bold text-zinc-900">Notifications</h2>
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 px-2 py-1 rounded">
          {notifications.filter(n => !n.read).length} Nouvelles
        </span>
      </div>

      <AnimatePresence>
        {notifications.length === 0 ? (
          <div className="text-center py-20 bg-white border border-zinc-100 rounded-2xl">
            <Bell size={40} className="mx-auto text-zinc-100 mb-4" />
            <p className="text-zinc-400 text-sm">Aucune notification pour le moment.</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                notif.read ? 'bg-white border-zinc-50 opacity-60' : 'bg-white border-zinc-200 shadow-sm'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center shrink-0 border border-zinc-100">
                {getIcon(notif.type)}
              </div>
              <div className="flex-1">
                <p className="text-sm text-zinc-700">
                  <span className="font-bold text-zinc-900">{notif.fromPseudonym}</span>
                  {notif.type === 'like' && ' a aimé votre publication'}
                  {notif.type === 'repost' && ' a republié votre article'}
                  {notif.type === 'message' && ' vous a envoyé un message sécurisé'}
                  {notif.type === 'mention' && ' vous a mentionné'}
                </p>
                <p className="text-[10px] text-zinc-400 mt-1 uppercase font-medium">
                  {notif.createdAt ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true, locale: fr }) : ''}
                </p>
              </div>
              {!notif.read && (
                <button 
                  onClick={() => markAsRead(notif.id)}
                  title="Marquer comme lu"
                  className="btn-icon-press p-2 hover:bg-zinc-50 rounded-xl transition-colors text-zinc-400 hover:text-pink-600"
                >
                  <Check size={16} />
                </button>
              )}
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}
