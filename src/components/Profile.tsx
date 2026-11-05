import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, Calendar, Shield, AtSign, PlusCircle, Trash2, Send, Palette, Check, X, Repeat, Heart, MessageSquare, Briefcase } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GRADIENTS } from '../lib/constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Reactive typography helper (Idea 1)
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

export function Profile() {
  const { profile, user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(profile?.bio || '');
  const [pseudonym, setPseudonym] = useState(profile?.pseudonym || '');
  const [headline, setHeadline] = useState(profile?.headline || '');
  const [bannerGradient, setBannerGradient] = useState<string>(
    profile?.bannerGradient || 'bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888]'
  );
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Post Creator State on Profile
  const [showCreator, setShowCreator] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [selectedGradient, setSelectedGradient] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  
  // User's own posts list
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync profile data when loaded
  useEffect(() => {
    if (profile) {
      setPseudonym(profile.pseudonym || '');
      setBio(profile.bio || '');
      setHeadline(profile.headline || '');
      if (profile.bannerGradient) {
        setBannerGradient(profile.bannerGradient);
      }
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'posts'), 
      where('authorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setMyPosts(postsData);
    }, (error) => {
      console.warn("My posts listener:", error);
    });
    return () => unsubscribe();
  }, [user]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateProfile({ 
        bio, 
        pseudonym, 
        headline, 
        bannerGradient 
      });
      setIsEditing(false);
      setShowBannerPicker(false);
      showToast('Profil et couverture mis à jour !');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user?.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBannerGradient = async (gradientClass: string) => {
    setBannerGradient(gradientClass);
    try {
      await updateProfile({ bannerGradient: gradientClass });
      setShowBannerPicker(false);
      showToast('Bannière de profil mise à jour !');
    } catch (error) {
      console.warn("Banner update:", error);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !profile || !user) return;

    setPublishing(true);
    try {
      if (editingPost) {
        await updateDoc(doc(db, 'posts', editingPost.id), {
          content: newPost.trim(),
          background: selectedGradient,
          updatedAt: serverTimestamp(),
        });
        showToast('Publication mise à jour !');
        setEditingPost(null);
      } else {
        await addDoc(collection(db, 'posts'), {
          authorId: user.uid,
          content: newPost.trim(),
          mediaType: 'text',
          mediaUrl: null,
          background: selectedGradient || null,
          createdAt: serverTimestamp(),
          pseudonym: profile.pseudonym || 'Membre',
          repostOf: null,
          originalAuthor: null,
          likesCount: 0,
          commentsCount: 0,
          repostsCount: 0,
        });
        showToast('Publication créée et diffusée sur tous les fils !');
      }
      setNewPost('');
      setSelectedGradient(null);
      setShowCreator(false);
    } catch (error) {
      handleFirestoreError(error, editingPost ? OperationType.UPDATE : OperationType.CREATE, 'posts');
    } finally {
      setPublishing(false);
    }
  };

  const executeDeletePost = async () => {
    if (!postToDelete || !user) return;
    try {
      await deleteDoc(doc(db, 'posts', postToDelete.id));
      setPostToDelete(null);
      showToast('Publication supprimée avec succès !');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postToDelete.id}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20 md:pb-6"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-semibold"
          >
            <Check size={18} />
            {toastMessage}
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
                  onClick={executeDeletePost}
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

      {/* Header Profile Card with Coordinated Banner (Idea 4) */}
      <div className="bg-white border border-zinc-200/80 rounded-3xl overflow-hidden shadow-sm">
        {/* Banner with Live Gradient & Customizer Button */}
        <div className={cn("h-36 sm:h-44 transition-all duration-500 relative group overflow-hidden", profile?.bannerGradient || bannerGradient)}>
          <button
            type="button"
            onClick={() => setShowBannerPicker(!showBannerPicker)}
            title="Changer le dégradé de couverture"
            className="btn-icon-press absolute top-4 right-4 z-10 px-3.5 py-1.5 rounded-xl bg-black/35 backdrop-blur-md text-white text-xs font-semibold hover:bg-black/55 transition-all flex items-center gap-1.5 border border-white/20 shadow-md"
          >
            <Palette size={14} />
            <span>Changer la couverture</span>
          </button>

          {/* Banner Gradient Selector Popover */}
          <AnimatePresence>
            {showBannerPicker && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute inset-x-4 top-14 z-20 bg-white/95 backdrop-blur-xl p-4 rounded-2xl border border-zinc-200 shadow-2xl space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800">Choisissez votre dégradé de profil :</span>
                  <button 
                    onClick={() => setShowBannerPicker(false)}
                    className="p-1 text-zinc-400 hover:text-zinc-700"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {GRADIENTS.map((g, idx) => (
                    <button
                      key={idx}
                      type="button"
                      title={g.name}
                      onClick={() => handleSelectBannerGradient(g.class)}
                      className={cn(
                        "h-8 rounded-lg transition-all btn-icon-press relative overflow-hidden border",
                        g.class,
                        (bannerGradient === g.class) ? "ring-2 ring-pink-500 scale-105" : "border-black/5"
                      )}
                    >
                      {bannerGradient === g.class && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                          <Check size={12} className="stroke-[3]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-8 pb-8 relative">
          <div className="absolute -top-14 left-8">
            <div className="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-xl flex items-center justify-center text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] overflow-hidden">
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                profile?.pseudonym ? profile.pseudonym[0].toUpperCase() : 'P'
              )}
            </div>
          </div>
          
          <div className="pt-14 flex flex-wrap justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-zinc-900">{profile?.pseudonym}</h2>
              {/* Professional Headline (Idea 4) */}
              {profile?.headline ? (
                <p className="text-sm font-semibold text-zinc-700 mt-0.5 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-pink-600 shrink-0" />
                  <span>{profile.headline}</span>
                </p>
              ) : (
                <p className="text-zinc-400 text-xs mt-0.5 italic">Aucun domaine d'expertise renseigné</p>
              )}
              <p className="text-xs text-pink-600 font-semibold mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" /> E2EE Chiffré · Session Sécurisée
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setEditingPost(null);
                  setNewPost('');
                  setSelectedGradient(null);
                  setShowCreator(!showCreator);
                }}
                className={cn(
                  "btn-icon-press flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-md transition-all",
                  "bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 hover:opacity-95"
                )}
              >
                <PlusCircle size={18} />
                <span>Créer une publication</span>
              </button>

              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="btn-icon-press flex items-center gap-2 px-4 py-2.5 border border-zinc-200 rounded-2xl text-sm font-semibold hover:border-pink-300 text-zinc-700 hover:text-pink-600 transition-all"
              >
                <Edit3 size={16} />
                <span>Modifier le profil</span>
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Pseudonyme</label>
                  <input 
                    type="text" 
                    value={pseudonym} 
                    onChange={(e) => setPseudonym(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Domaine d'expertise / Statut pro</label>
                  <input 
                    type="text" 
                    value={headline} 
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Ex: FinTech & Cryptographie, Architecte Cloud..."
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Biographie</label>
                  <textarea 
                    value={bio} 
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 text-sm resize-none"
                    placeholder="Parlez-nous de votre vision..."
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleUpdate}
                    disabled={loading}
                    className="btn-icon-press flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 shadow-md"
                  >
                    Sauvegarder
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="btn-icon-press flex-1 bg-zinc-100 text-zinc-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-zinc-700 leading-relaxed max-w-lg">
                  {profile?.bio || "Aucune biographie ajoutée."}
                </p>
                <div className="flex flex-wrap gap-6 text-zinc-400 text-xs font-medium uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-zinc-300" />
                    <span>Chiffrement E2EE</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-zinc-300" />
                    <span>Inscrit en 2026</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AtSign size={14} className="text-zinc-300" />
                    <span>{profile?.pseudonym}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Publication Creator on Profile */}
      <AnimatePresence>
        {showCreator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white text-xs font-bold">
                  {profile?.pseudonym ? profile.pseudonym[0].toUpperCase() : 'P'}
                </div>
                <h3 className="font-bold text-zinc-900 text-sm">
                  {editingPost ? 'Modifier votre publication' : 'Créer une nouvelle publication'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowCreator(false); setEditingPost(null); }}
                className="btn-icon-press p-1.5 text-zinc-400 hover:text-zinc-700 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4">
              {/* Live Preview with Reactive Typography (Idea 1) */}
              <div className={cn(
                "rounded-2xl transition-all duration-300 p-6 sm:p-8",
                selectedGradient ? cn(selectedGradient, "gradient-card-gloss min-h-[160px] flex items-center justify-center text-center") : "bg-zinc-50 border border-zinc-200/70"
              )}>
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Partagez vos idées ou réflexions avec le réseau..."
                  className={cn(
                    "w-full bg-transparent border-none focus:outline-none focus:ring-0 resize-none py-2 leading-relaxed transition-all",
                    selectedGradient 
                      ? cn("text-center text-white placeholder-white/60 drop-shadow-sm", getReactiveTypography(newPost || "Votre aperçu en direct")) 
                      : "text-zinc-900 placeholder-zinc-400 text-base"
                  )}
                  rows={selectedGradient ? 4 : 3}
                />
              </div>

              {/* 16 Gradients Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500 font-medium px-1">
                  <span>Sélectionnez un fond dégradé (16 styles) :</span>
                  {selectedGradient && (
                    <button 
                      type="button" 
                      onClick={() => setSelectedGradient(null)}
                      className="text-pink-600 hover:text-pink-700 font-semibold text-xs"
                    >
                      Sans fond
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5 p-3 bg-zinc-50 rounded-2xl border border-zinc-200/60">
                  {GRADIENTS.map((g, idx) => (
                    <button
                      key={idx}
                      type="button"
                      title={g.name}
                      onClick={() => setSelectedGradient(idx === 0 ? null : g.class)}
                      className={cn(
                        "h-10 rounded-xl transition-all btn-icon-press relative group overflow-hidden border",
                        g.class,
                        (selectedGradient === g.class || (idx === 0 && !selectedGradient))
                          ? "ring-2 ring-pink-500 scale-105 shadow-md border-pink-400" 
                          : "border-black/5 hover:scale-100"
                      )}
                    >
                      {(selectedGradient === g.class || (idx === 0 && !selectedGradient)) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => { setShowCreator(false); setEditingPost(null); }}
                  className="btn-icon-press px-4 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={publishing || !newPost.trim()}
                  className="btn-icon-press px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 hover:opacity-95 shadow-md hover:shadow-lg disabled:opacity-40 flex items-center gap-2 text-sm"
                >
                  {publishing ? 'Publication...' : editingPost ? 'Mettre à jour' : 'Publier maintenant'}
                  {!publishing && <Send size={15} />}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User's Publications Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-display font-bold text-zinc-900">Mes Publications</h3>
          <span className="text-xs font-semibold text-zinc-400">
            {myPosts.length} publication{myPosts.length > 1 ? 's' : ''}
          </span>
        </div>

        {myPosts.length === 0 ? (
          <div className="text-center py-12 bg-white border border-zinc-200/80 rounded-3xl p-6">
            <p className="text-sm text-zinc-500 mb-4">Vous n'avez pas encore publié d'articles.</p>
            <button
              onClick={() => { setShowCreator(true); setNewPost(''); setSelectedGradient(null); }}
              className="btn-icon-press inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 shadow-md"
            >
              <PlusCircle size={16} />
              <span>Créer ma première publication</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myPosts.map((post) => (
              <div 
                key={post.id}
                className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                    <span>{post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true, locale: fr }) : 'À l\'instant'}</span>
                    {post.updatedAt && <span>· Modifié</span>}
                    {post.repostOf && <span className="text-pink-600 flex items-center gap-1 font-semibold"><Repeat size={12} /> Republié</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingPost(post);
                        setNewPost(post.content);
                        setSelectedGradient(post.background || null);
                        setShowCreator(true);
                        window.scrollTo({ top: 300, behavior: 'smooth' });
                      }}
                      title="Modifier"
                      className="btn-icon-press p-2 text-zinc-400 hover:text-zinc-900 rounded-xl"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => setPostToDelete(post)}
                      title="Supprimer la publication"
                      className="btn-icon-press p-2 text-zinc-400 hover:text-red-600 rounded-xl"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Post Content with Reactive Typography (Idea 1) */}
                <div className={cn(
                  "rounded-2xl transition-all p-6 mb-4",
                  post.background 
                    ? cn(post.background, "gradient-card-gloss min-h-[140px] flex items-center justify-center text-center") 
                    : "bg-zinc-50 text-zinc-800"
                )}>
                  <p className={cn(
                    "whitespace-pre-wrap leading-relaxed",
                    post.background 
                      ? cn("text-white drop-shadow-sm", getReactiveTypography(post.content)) 
                      : "text-sm text-zinc-800"
                  )}>
                    {post.content}
                  </p>
                </div>

                <div className="flex items-center gap-6 text-xs text-zinc-400 font-medium pt-2 border-t border-zinc-100">
                  <span className="flex items-center gap-1.5">
                    <Heart size={14} className={post.likesCount ? "fill-pink-500 text-pink-500" : ""} />
                    {post.likesCount || 0}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare size={14} />
                    {post.commentsCount || 0}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Repeat size={14} />
                    {post.repostsCount || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
