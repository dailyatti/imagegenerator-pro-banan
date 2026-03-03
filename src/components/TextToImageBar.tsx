
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Image as ImageIcon, Wand2, Mic, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OutputFormat, AiResolution, AspectRatio } from '../types';
import { enhancePrompt } from '../services/geminiService';

interface TextToImageBarProps {
  prompt: string;
  config: { format: OutputFormat; resolution: AiResolution; aspectRatio: AspectRatio };
  onPromptChange: (val: string) => void;
  onConfigChange: (key: string, val: any) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export const TextToImageBar: React.FC<TextToImageBarProps> = ({ 
    prompt, 
    config, 
    onPromptChange, 
    onConfigChange, 
    onGenerate, 
    isGenerating 
}) => {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) {
      onGenerate();
    }
  };

  const handleMagicEnhance = async () => {
      if (!prompt.trim()) return;
      setIsEnhancing(true);
      try {
          const enhanced = await enhancePrompt(prompt);
          // Typewriter effect simulation could go here, but direct set is faster for UX
          onPromptChange(enhanced);
      } catch (e) {
          console.error(e);
      } finally {
          setIsEnhancing(false);
      }
  };

  const startDictation = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.lang = 'en-US'; 
      recognition.start();
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onPromptChange(transcript);
      };
    } else {
      alert("Browser not supported for native dictation.");
    }
  };

  const isReady = prompt.trim().length > 0;

  return (
    <div className="w-full max-w-4xl mx-auto mb-10 relative z-30">
        <div className="flex items-center justify-between mb-2 px-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/30 border border-emerald-900 px-2 py-0.5 rounded flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {t('nativeGenTitle')}
                </span>
            </div>
        </div>
        
        <form onSubmit={handleSubmit} className={`relative group transition-all duration-300 ${isFocused ? 'scale-[1.01]' : ''}`}>
             <div className={`absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-indigo-500 rounded-xl opacity-30 blur group-hover:opacity-60 transition duration-500 ${isFocused ? 'opacity-80' : ''}`}></div>
             
             <div className="relative bg-[#0f172a] rounded-xl border border-slate-700 flex flex-col md:flex-row items-center p-1.5 shadow-xl">
                 <div className="pl-3 pr-2 text-slate-500 hidden md:block">
                     <ImageIcon className="w-5 h-5" />
                 </div>
                 
                 <div className="flex-1 w-full relative">
                     <input 
                        type="text" 
                        value={prompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder={t('txt2imgPlaceholder')}
                        className="w-full bg-transparent border-none outline-none text-slate-200 text-sm placeholder:text-slate-500 py-3 px-3 md:px-0 pr-20"
                     />
                     <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                         <button 
                            type="button"
                            onClick={startDictation}
                            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                            title="Dictate"
                         >
                             <Mic className="w-3.5 h-3.5" />
                         </button>
                         <button 
                            type="button"
                            onClick={handleMagicEnhance}
                            disabled={isEnhancing || !prompt.trim()}
                            className={`p-1.5 rounded-md transition-all ${isEnhancing ? 'text-purple-400 animate-pulse' : 'text-slate-500 hover:text-purple-400 hover:bg-purple-900/20'}`}
                            title="AI Enhance Prompt"
                         >
                             <Wand2 className="w-3.5 h-3.5" />
                         </button>
                     </div>
                 </div>

                 {/* Configuration Toggles */}
                 <div className="flex items-center gap-2 px-2 border-t md:border-t-0 md:border-l border-slate-700 pt-2 md:pt-0 w-full md:w-auto justify-end">
                    <div className="flex gap-2">
                        <select 
                            value={config.aspectRatio} 
                            onChange={(e) => onConfigChange('aspectRatio', e.target.value as AspectRatio)}
                            className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded px-2 py-1.5 outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            <option value={AspectRatio.SQUARE}>1:1</option>
                            <option value={AspectRatio.LANDSCAPE}>16:9</option>
                            <option value={AspectRatio.PORTRAIT}>9:16</option>
                        </select>
                         <select 
                            value={config.resolution} 
                            onChange={(e) => onConfigChange('resolution', e.target.value as AiResolution)}
                            className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded px-2 py-1.5 outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            <option value={AiResolution.RES_1K}>1K</option>
                            <option value={AiResolution.RES_2K}>2K</option>
                            <option value={AiResolution.RES_4K}>4K</option>
                        </select>
                        <select 
                            value={config.format} 
                            onChange={(e) => onConfigChange('format', e.target.value as OutputFormat)}
                            className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded px-2 py-1.5 outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            <option value={OutputFormat.JPG}>JPG</option>
                            <option value={OutputFormat.PNG}>PNG</option>
                            <option value={OutputFormat.WEBP}>WEBP</option>
                        </select>
                    </div>

                    <button 
                        type="submit" 
                        disabled={!isReady || isGenerating}
                        className={`ml-2 px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-all 
                        ${isReady && !isGenerating ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 animate-pulse-subtle' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span className="hidden md:inline">{t('processing')}</span>
                            </>
                        ) : (
                            <>
                                <span className="hidden md:inline">{t('generateNative')}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </>
                        )}
                    </button>
                 </div>
             </div>
        </form>
        <style>{`
            @keyframes pulse-subtle {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.9; transform: scale(1.02); }
            }
            .animate-pulse-subtle {
                animation: pulse-subtle 2s infinite;
            }
        `}</style>
    </div>
  );
};
