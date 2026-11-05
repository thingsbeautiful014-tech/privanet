import { motion } from 'framer-motion';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <div className="w-12 h-12 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mb-4" />
        <h1 className="text-xl font-display font-bold tracking-tight text-zinc-900">PrivaNet</h1>
        <p className="text-sm text-zinc-500 mt-2">Initialisation sécurisée...</p>
      </motion.div>
    </div>
  );
}
