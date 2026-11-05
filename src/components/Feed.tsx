import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, getDoc, setDoc, increment } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Repeat, Heart, Send, Trash2, Edit3, X, CornerDownRight, Check, Sparkles, ArrowUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getReactiveTypography(text: string) {
  const len = text.trim().length;
  if (len < 65) {
    return "text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug drop-shadow-md";
  } else if (len < 140) {
    return "text-xl sm:text-2xl font-bold tracking-tight leading-normal drop-shadow-sm";
  } else if (len < 280) {
    return "text-base sm:text-lg font-semibold leading-relaxed";
  } else {
    return "text-sm sm:text-base font-medium leading-relaxed";
  }
}

interface Post {
  id: string;
  authorId: string;
  content: string;
  mediaType: 'text' | 'image' | 'video';
  mediaUrl?: string | null;
  background?: string | null;
  createdAt: any;
  updatedAt?: any;
  pseudonym: string;
  repostOf?: string | null;
  originalAuthor?: string | null;
  likesCount?: number;
  commentsCount?: number;
  repostsCount?: number;
}

interface Comment {
  id: string;
  postId: string;
  authorId: string;
  pseudonym: string;
  content: string;
  parentId?: string | null;
  replyToPseudonym?: string | null;
  createdAt: any;
}

export function Feed() {
  const { profile, user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<{ postId: string; commentId: string; pseudonym: string } | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [repostingId, setRepostingId] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 250);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const showNotificationToast = (text: string) => {
    setActionNotice(text);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Listen to feed posts in real-time across all users
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(postsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });

    return () => unsubscribe();
  }, []);

  // Check which posts the current user has liked
  useEffect(() => {
    if (!user || posts.length === 0) return;
    const checkLikes = async () => {
      const likedSet = new Set<string>();
      for (const p of posts) {
        try {
          const snap = await getDoc(doc(db, 'posts', p.id, 'likes', user.uid));
          if (snap.exists()) {
            likedSet.add(p.id);
          }
        } catch {
          // ignore error
        }
      }
      setLikedPosts(likedSet);
    };
    checkLikes();
  }, [user, posts.map(p => p.id).join(',')]);

  // Toggle comments for a specific post
  const toggleComments = (postId: string) => {
    if (expandedComments[postId]) {
      setExpandedComments(prev => ({ ...prev, [postId]: false }));
      return;
    }

    const q = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'asc'));
    onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
      setComments(prev => ({ ...prev, [postId]: commentsData }));
    });

    setExpandedComments(prev => ({ ...prev, [postId]: true }));
  };

  // Like / Unlike with atomic updates & instant UI feedback
  const handleLike = async (post: Post) => {
    if (!user || !profile) return;
    
    const isCurrentlyLiked = likedPosts.has(post.id);
    const newLikedSet = new Set(likedPosts);
    if (isCurrentlyLiked) {
      newLikedSet.delete(post.id);
    } else {
      newLikedSet.add(post.id);
    }
    setLikedPosts(newLikedSet);

    try {
      const likeRef = doc(db, 'posts', post.id, 'likes', user.uid);
      const postRef = doc(db, 'posts', post.id);

      if (isCurrentlyLiked) {
        await deleteDoc(likeRef);
        await updateDoc(postRef, {
          likesCount: increment(-1)
        });
      } else {
        await setDoc(likeRef, {
          userId: user.uid,
          postId: post.id,
          createdAt: serverTimestamp(),
        });
        await updateDoc(postRef, {
          likesCount: increment(1)
        });

        // Non-blocking notification
        if (post.authorId !== user.uid) {
          addDoc(collection(db, 'notifications'), {
            userId: post.authorId,
            type: 'like',
            fromUserId: user.uid,
            fromPseudonym: profile.pseudonym,
            postId: post.id,
            createdAt: serverTimestamp(),
            read: false,
          }).catch(console.warn);
        }
      }
    } catch (error) {
      // Rollback on failure
      setLikedPosts(likedPosts);
      handleFirestoreError(error, OperationType.WRITE, `posts/${post.id}/likes`);
    }
  };

  // Repost a publication to the feed
  const handleRepost = async (post: Post) => {
    if (!user || !profile) return;

    setRepostingId(post.id);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        pseudonym: profile.pseudonym,
        content: post.content,
        mediaType: post.mediaType || 'text',
        mediaUrl: post.mediaUrl || null,
        background: post.background || null,
        repostOf: post.id,
        originalAuthor: post.originalAuthor || post.pseudonym,
        createdAt: serverTimestamp(),
        likesCount: 0,
        commentsCount: 0,
        repostsCount: 0,
      });

      // Update original post reposts count
      updateDoc(doc(db, 'posts', post.id), {
        repostsCount: increment(1)
      }).catch(console.warn);

      // Non-blocking notification to original author
      if (post.authorId !== user.uid) {
        addDoc(collection(db, 'notifications'), {
          userId: post.authorId,
          type: 'repost',
          fromUserId: user.uid,
          fromPseudonym: profile.pseudonym,
          postId: post.id,
          createdAt: serverTimestamp(),
          read: false,
        }).catch(console.warn);
      }

      showNotificationToast('Publication republiée avec succès sur le fil !');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    } finally {
      setRepostingId(null);
    }
  };

  // Add Comment or Reply
  const handleAddComment = async (postId: string) => {
    const content = newComments[postId];
    if (!content?.trim() || !profile || !user) return;

    try {
      const commentRef = collection(db, `posts/${postId}/comments`);
      await addDoc(commentRef, {
        postId,
        authorId: user.uid,
        pseudonym: profile.pseudonym,
        content: content.trim(),
        parentId: replyingTo?.postId === postId ? replyingTo.commentId : null,
        replyToPseudonym: replyingTo?.postId === postId ? replyingTo.pseudonym : null,
        createdAt: serverTimestamp(),
      });
      
      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: increment(1)
      });

      // Non-blocking notification
      const targetPost = posts.find(p => p.id === postId);
      if (targetPost && targetPost.authorId !== user.uid) {
        addDoc(collection(db, 'notifications'), {
          userId: targetPost.authorId,
          type: 'mention',
          fromUserId: user.uid,
          fromPseudonym: profile.pseudonym,
          postId,
          createdAt: serverTimestamp(),
          read: false,
        }).catch(console.warn);
      }

      setNewComments(prev => ({ ...prev, [postId]: '' }));
      setReplyingTo(null);
      showNotificationToast('Commentaire ajouté en direct !');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `posts/${postId}/comments`);
    }
  };

  // Delete Post (guaranteed working with in-app modal, NO window.confirm blocker)
  const executeDelete = async () => {
    if (!postToDelete || !user) return;
    try {
      await deleteDoc(doc(db, 'posts', postToDelete.id));
      setPostToDelete(null);
      showNotificationToast('Publication supprimée.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postToDelete.id}`);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Toast Notice */}
      <AnimatePresence>
        {actionNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-semibold"
          >
            <Check size={18} />
            {actionNotice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal (NO window.confirm blocker) */}
      <AnimatePresence>
        {postToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-zinc-200"
            >
              <h3 className="text-lg font-bold text-zinc-900 mb-2">Supprimer la publication ?</h3>
              <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
                Cette publication sera définitivement effacée de votre profil et du fil d'actualité de tous les utilisateurs.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={executeDelete}
                  className="btn-icon-press flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 transition-all shadow-md"
                >
                  Supprimer
                </button>
                <button
                  type="button"
                  onClick={() => setPostToDelete(null)}
                  className="btn-icon-press flex-1 bg-zinc-100 text-zinc-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-all"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clean Feed Header */}
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <div>
          <h2 className="text-2xl font-display font-bold text-zinc-900">Fil d'actualité</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Publications synchronisées en temps réel</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-50 to-pink-50 border border-pink-200/60 rounded-full">
          <Sparkles size={12} className="text-pink-600" />
          <span className="text-[11px] font-bold text-pink-700 tracking-wide">Live Sync</span>
        </div>
      </div>

      {/* Publications Stream */}
      <div className="space-y-5">
        <AnimatePresence>
          {posts.length === 0 ? (
            <div className="text-center py-16 bg-white border border-zinc-200/80 rounded-3xl p-6">
              <p className="text-sm text-zinc-500 mb-2">Aucune publication pour le moment.</p>
              <p className="text-xs text-zinc-400">Rendez-vous dans la section "Mon Profil" pour créer la première publication !</p>
            </div>
          ) : (
            posts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all"
              >
                {/* Repost Header Indicator if it's a republication */}
                {post.repostOf && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-pink-600 pb-3 mb-3 border-b border-zinc-100">
                    <div className="p-1 rounded-md bg-pink-50">
                      <Repeat size={13} className="text-pink-600" />
                    </div>
                    <span>{post.pseudonym} a republié cet article</span>
                  </div>
                )}

                {/* Author & Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-sm font-bold text-zinc-700">
                      {(post.originalAuthor || post.pseudonym)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-900">
                          {post.originalAuthor || post.pseudonym}
                        </h3>
                        {post.originalAuthor && (
                          <span className="text-[10px] text-zinc-400 font-medium">(Auteur initial)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <span>{post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true, locale: fr }) : 'À l\'instant'}</span>
                        {post.updatedAt && <span>· Modifié</span>}
                      </div>
                    </div>
                  </div>

                  {/* Delete Control for Author */}
                  {post.authorId === user?.uid && (
                    <button 
                      onClick={() => setPostToDelete(post)}
                      title="Supprimer la publication"
                      className="btn-icon-press p-2 text-zinc-400 hover:text-red-600 transition-colors rounded-xl"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Post Content with Selected Gradient or Plain Body (Idea 1) */}
                <div className={cn(
                  "rounded-2xl transition-all duration-300 p-6 sm:p-8 mb-5",
                  post.background 
                    ? cn(post.background, "gradient-card-gloss min-h-[160px] flex items-center justify-center text-center") 
                    : "bg-zinc-50/70 border border-zinc-100 text-zinc-800"
                )}>
                  <p className={cn(
                    "whitespace-pre-wrap leading-relaxed",
                    post.background 
                      ? cn("text-white", getReactiveTypography(post.content)) 
                      : "text-base font-normal text-zinc-800"
                  )}>
                    {post.content}
                  </p>
                </div>

                {/* Interaction Bar: Like, Comment, Repost */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                  <div className="flex items-center gap-3 sm:gap-6">
                    {/* Like Button */}
                    <button 
                      onClick={() => handleLike(post)}
                      title={likedPosts.has(post.id) ? "Ne plus aimer" : "Aimer la publication"}
                      className={cn(
                        "btn-icon-press flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all",
                        likedPosts.has(post.id) 
                          ? "text-pink-600 bg-pink-50/70 btn-icon-active" 
                          : "text-zinc-500 hover:text-pink-600"
                      )}
                    >
                      <Heart 
                        size={18} 
                        className={cn(
                          "transition-transform",
                          likedPosts.has(post.id) ? "fill-pink-600 text-pink-600 scale-110" : ""
                        )} 
                      />
                      <span>{Math.max(0, post.likesCount || 0)}</span>
                    </button>

                    {/* Comment Button */}
                    <button 
                      onClick={() => toggleComments(post.id)}
                      title="Voir et ajouter des commentaires"
                      className={cn(
                        "btn-icon-press flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all",
                        expandedComments[post.id] 
                          ? "text-purple-600 bg-purple-50 btn-icon-active" 
                          : "text-zinc-500 hover:text-purple-600"
                      )}
                    >
                      <MessageSquare size={18} />
                      <span>{Math.max(0, post.commentsCount || 0)}</span>
                    </button>

                    {/* Repost Button */}
                    <button 
                      onClick={() => handleRepost(post)}
                      disabled={repostingId === post.id}
                      title="Republier sur votre profil"
                      className={cn(
                        "btn-icon-press flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-zinc-500 hover:text-emerald-600 transition-all",
                        post.repostsCount ? "text-emerald-600" : ""
                      )}
                    >
                      <Repeat size={18} className={repostingId === post.id ? "animate-spin text-pink-600" : ""} />
                      <span>{Math.max(0, post.repostsCount || 0)}</span>
                    </button>
                  </div>
                </div>

                {/* Nested Comments Section */}
                <AnimatePresence>
                  {expandedComments[post.id] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-5 pt-4 border-t border-zinc-100 space-y-4"
                    >
                      {/* Existing Comments */}
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {(!comments[post.id] || comments[post.id].length === 0) ? (
                          <p className="text-xs text-zinc-400 italic text-center py-3">
                            Soyez le premier à commenter cette publication.
                          </p>
                        ) : (
                          comments[post.id].map((comm) => (
                            <div 
                              key={comm.id} 
                              className={cn(
                                "flex flex-col gap-1.5 p-3 rounded-2xl bg-zinc-50/80 border border-zinc-100/80 transition-all",
                                comm.parentId ? "ml-6 border-l-2 border-l-pink-400" : ""
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-700">
                                    {comm.pseudonym[0].toUpperCase()}
                                  </div>
                                  <span className="text-xs font-bold text-zinc-900">{comm.pseudonym}</span>
                                  {comm.replyToPseudonym && (
                                    <span className="text-[11px] text-pink-600 font-medium">
                                      → @{comm.replyToPseudonym}
                                    </span>
                                  )}
                              </div>
                              <span className="text-[10px] text-zinc-400">
                                {comm.createdAt ? formatDistanceToNow(comm.createdAt.toDate(), { addSuffix: true, locale: fr }) : ''}
                              </span>
                            </div>

                            <p className="text-xs text-zinc-700 pl-7 leading-relaxed">{comm.content}</p>

                            <div className="pl-7 pt-1">
                              <button 
                                onClick={() => setReplyingTo({ postId: post.id, commentId: comm.id, pseudonym: comm.pseudonym })}
                                className="btn-icon-press text-[11px] text-pink-600 font-semibold hover:underline px-1.5 py-0.5 rounded"
                              >
                                Répondre
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Comment Composer */}
                    <div className="space-y-2 pt-2">
                      {replyingTo?.postId === post.id && (
                        <div className="flex items-center justify-between text-xs bg-pink-50 text-pink-700 px-3 py-1.5 rounded-xl border border-pink-200">
                          <span className="flex items-center gap-1.5 font-medium">
                            <CornerDownRight size={13} /> Réponse à @{replyingTo.pseudonym}
                          </span>
                          <button 
                            onClick={() => setReplyingTo(null)} 
                            className="font-bold text-pink-800 hover:text-pink-950"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newComments[post.id] || ''}
                          onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddComment(post.id);
                            }
                          }}
                          placeholder={replyingTo?.postId === post.id ? `Répondre à @${replyingTo.pseudonym}...` : "Écrire un commentaire sécurisé..."}
                          className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddComment(post.id)}
                          disabled={!newComments[post.id]?.trim()}
                          className="btn-icon-press px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:opacity-90 disabled:opacity-40 shadow-sm"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )))}
        </AnimatePresence>
      </div>

      {/* Floating Back to Top Button (Idea 6) */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 15 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Remonter en haut du fil"
            className="btn-icon-press fixed bottom-20 md:bottom-8 right-6 z-40 w-12 h-12 rounded-2xl bg-white/95 backdrop-blur-md border border-zinc-200/90 shadow-xl flex items-center justify-center text-zinc-700 hover:text-pink-600 transition-all hover:scale-105 active:scale-95"
          >
            <ArrowUp size={20} className="stroke-[2.5]" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
