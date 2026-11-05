export interface GradientOption {
  name: string;
  class: string;
}

export const GRADIENTS: GradientOption[] = [
  { name: 'Épuré Blanc', class: 'bg-white text-zinc-900 border border-zinc-200' },
  { name: 'Instagram Sunset', class: 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white shadow-md' },
  { name: 'Violet Fuchsia', class: 'bg-gradient-to-tr from-purple-600 via-pink-600 to-rose-500 text-white shadow-md' },
  { name: 'Océan Indigo', class: 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-md' },
  { name: 'Cyber Émeraude', class: 'bg-gradient-to-tr from-emerald-500 via-teal-600 to-cyan-600 text-white shadow-md' },
  { name: 'Aurore Boréale', class: 'bg-gradient-to-tr from-teal-400 via-emerald-500 to-lime-500 text-white shadow-md' },
  { name: 'Crépuscule Doré', class: 'bg-gradient-to-tr from-amber-400 via-orange-500 to-red-500 text-white shadow-md' },
  { name: 'Obsidienne Minuit', class: 'bg-gradient-to-tr from-zinc-900 via-slate-900 to-black text-white shadow-md' },
  { name: 'Velours Royal', class: 'bg-gradient-to-tr from-indigo-900 via-purple-900 to-pink-800 text-white shadow-md' },
  { name: 'Rose Sakuri', class: 'bg-gradient-to-tr from-rose-400 via-pink-500 to-red-400 text-white shadow-md' },
  { name: 'Flamme Corail', class: 'bg-gradient-to-tr from-red-500 via-rose-500 to-amber-500 text-white shadow-md' },
  { name: 'Espace Profond', class: 'bg-gradient-to-tr from-blue-950 via-slate-900 to-purple-950 text-white shadow-md' },
  { name: 'Solaire Or', class: 'bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-600 text-white shadow-md' },
  { name: 'Bleu Électrique', class: 'bg-gradient-to-tr from-sky-400 via-blue-600 to-indigo-700 text-white shadow-md' },
  { name: 'Menthe Fraîche', class: 'bg-gradient-to-tr from-emerald-400 to-teal-500 text-white shadow-md' },
  { name: 'Fuchsia Cosmique', class: 'bg-gradient-to-tr from-fuchsia-600 via-purple-600 to-pink-500 text-white shadow-md' },
];
