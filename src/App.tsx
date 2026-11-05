import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoadingScreen } from './components/Loading';
import { Feed } from './components/Feed';
import { Chat } from './components/Chat';
import { Profile } from './components/Profile';
import { Notifications } from './components/Notifications';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, MessageSquare, User, LogOut, Bell } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function Onboarding() {
  const { updateProfile } = useAuth();
  const [pseudonym, setPseudonym] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pseudonym.length < 3) return;
    setLoading(true);
    await updateProfile({ pseudonym });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <h2 className="text-3xl font-display font-bold tracking-tight text-zinc-900 mb-2">Bienvenue sur PrivaNet</h2>
        <p className="text-zinc-500 mb-8 text-sm">Choisissez un pseudonyme pour commencer. Votre identité réelle reste totalement confidentielle.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Pseudonyme</label>
            <input
              type="text"
              value={pseudonym}
              onChange={(e) => setPseudonym(e.target.value)}
              placeholder="Ex: CyberSentinel"
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all text-zinc-900"
              required
              minLength={3}
              maxLength={30}
            />
          </div>
          <button
            type="submit"
            disabled={loading || pseudonym.length < 3}
            className="btn-icon-press w-full bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white py-3.5 rounded-2xl font-semibold hover:opacity-95 transition-all shadow-md hover:shadow-lg disabled:opacity-40"
          >
            {loading ? 'Création de votre session...' : 'Accéder au réseau confidentiel'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function MainApp() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'feed' | 'chat' | 'profile' | 'notifications'>('feed');

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-100 bg-white h-screen sticky top-0 p-6">
        <div className="mb-12 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] rounded-lg flex items-center justify-center shadow-sm">
             <span className="text-white text-xs font-bold italic">P</span>
          </div>
          <h1 className="text-xl font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]">PrivaNet</h1>
        </div>
        
        <nav className="flex-1 space-y-1.5">
          {[
            { id: 'feed', label: 'Fil d\'actualité', icon: Home },
            { id: 'chat', label: 'Messages Sécurisés', icon: MessageSquare },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'profile', label: 'Mon Profil', icon: User },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "btn-icon-press w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-sm font-medium",
                activeTab === item.id 
                  ? "bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white shadow-md font-semibold" 
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-100">
          <div className="flex items-center gap-3 mb-6 px-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-xs font-bold text-white shadow-sm">
              {profile?.pseudonym ? profile.pseudonym[0].toUpperCase() : 'P'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate text-zinc-900">{profile?.pseudonym}</p>
              <p className="text-[10px] text-pink-600 uppercase tracking-widest font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" /> E2EE Actif
              </p>
            </div>
          </div>
          <button 
            onClick={signOut}
            className="btn-icon-press w-full flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all text-sm font-medium"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen">
        <div className="max-w-2xl mx-auto py-8 px-6">
          <AnimatePresence mode="wait">
            {activeTab === 'feed' && <Feed key="feed" />}
            {activeTab === 'chat' && <Chat key="chat" />}
            {activeTab === 'notifications' && <Notifications key="notifications" />}
            {activeTab === 'profile' && <Profile key="profile" />}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-zinc-200/80 px-6 py-2.5 flex justify-between items-center z-40 shadow-lg">
        {[
          { id: 'feed', icon: Home },
          { id: 'chat', icon: MessageSquare },
          { id: 'notifications', icon: Bell },
          { id: 'profile', icon: User },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={cn(
              "btn-icon-press p-2.5 rounded-2xl transition-all",
              activeTab === item.id 
                ? "text-white bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-md scale-105" 
                : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            <item.icon size={22} />
          </button>
        ))}
      </nav>
    </div>
  );
}

function AuthWrapper() {
  const { user, profile, loading, signIn, isNewUser } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm w-full"
        >
          <div className="w-16 h-16 bg-gradient-to-tr from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888] rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl">
            <span className="text-white text-3xl font-bold italic">P</span>
          </div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-zinc-900 mb-3">PrivaNet</h1>
          <p className="text-zinc-500 mb-10 leading-relaxed">
            Le réseau social professionnel ultra-confidentiel.
            <br />
            <span className="font-medium text-zinc-900">Pas de surveillance. Pas de compromis.</span>
          </p>
          <button
            onClick={signIn}
            className="btn-icon-press w-full bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white py-4 rounded-2xl font-semibold hover:opacity-95 transition-all shadow-lg hover:shadow-xl"
          >
            Connexion Confidentielle
          </button>
          <p className="mt-6 text-[10px] text-zinc-400 uppercase tracking-widest font-medium">Chiffrement de bout en bout activé</p>
        </motion.div>
      </div>
    );
  }

  if (isNewUser) return <Onboarding />;

  return <MainApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthWrapper />
    </AuthProvider>
  );
}
