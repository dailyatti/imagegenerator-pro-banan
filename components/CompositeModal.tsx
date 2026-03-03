import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Layers, Check, Sparkles, Settings2, ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ImageItem, OutputFormat, AiResolution, AspectRatio } from '../types';

interface CompositeModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageItem[];
  onGenerate: (
      selectedIds: string[], 
      prompt: string, 
      config: { format: OutputFormat; resolution: AiResolution; aspectRatio: AspectRatio }
  ) => void;
}

export const CompositeModal: React.FC<CompositeModalProps> = ({ 
    isOpen, 
    onClose, 
    images, 
    onGenerate 
}) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState('');
  
  // Local Config State
  const [format, setFormat] = useState<OutputFormat>(OutputFormat.JPG);
  const [resolution, setResolution] = useState<AiResolution>(AiResolution.RES_2K);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);

  // Select all by default when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(images.map(i => i.id)));
      setPrompt('');
      // Defaults
      setFormat(OutputFormat.JPG);
      setResolution(AiResolution.RES_2K);
      setAspectRatio(AspectRatio.SQUARE);
    }
  }, [isOpen, images]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleGenerate = () => {
    onGenerate(Array.from(selectedIds), prompt, { format, resolution, aspectRatio });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-[#0f172a] border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-[#020617]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/10 rounded-lg">
                <Layers className="w-5 h-5 text-pink-500" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white">{t('composite')}</h2>
                <p className="text-xs text-slate-400">{t('compositeDesc')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> {t('selectImages')} ({selectedIds.size})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
                {images.map(img => {
                    const isSelected = selectedIds.has(img.id);
                    return (
                        <div 
                            key={img.id} 
                            onClick={() => toggleSelection(img.id)}
                            className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all group ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-800 hover:border-slate-600'}`}
                        >
                            <img src={img.previewUrl} alt="" className={`w-full h-full object-cover transition-all ${isSelected ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'}`} />
                            <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-900/50 border border-slate-600'}`}>
                                {isSelected && <Check className="w-3 h-3" />}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Configuration Section */}
            <div className="mb-6 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-pink-400"/> {t('compositeConfig')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase">{t('format')}</label>
                        <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2.5 outline-none focus:border-pink-500/50">
                            <option value={OutputFormat.JPG}>JPG</option>
                            <option value={OutputFormat.PNG}>PNG</option>
                            <option value={OutputFormat.WEBP}>WEBP</option>
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase">{t('aspectRatio')}</label>
                        <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2.5 outline-none focus:border-pink-500/50">
                            <option value={AspectRatio.SQUARE}>1:1 Square</option>
                            <option value={AspectRatio.LANDSCAPE}>16:9 Wide</option>
                            <option value={AspectRatio.PORTRAIT}>9:16 Tall</option>
                            <option value={AspectRatio.STANDARD_LANDSCAPE}>4:3 Photo</option>
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase">{t('resolution')}</label>
                        <select value={resolution} onChange={(e) => setResolution(e.target.value as AiResolution)} className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2.5 outline-none focus:border-pink-500/50">
                            <option value={AiResolution.RES_1K}>1K</option>
                            <option value={AiResolution.RES_2K}>2K</option>
                            <option value={AiResolution.RES_4K}>4K</option>
                        </select>
                     </div>
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">{t('compositePrompt')}</h3>
                <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe how to merge these images (e.g., 'Double exposure of the portrait and the forest', 'Cyberpunk collage')"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 text-sm focus:border-pink-500/50 outline-none h-24 resize-none"
                />
            </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-[#020617] flex justify-end gap-3">
             <button onClick={onClose} className="px-5 py-2.5 rounded-lg font-bold text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                 {t('cancel')}
             </button>
             <button 
                onClick={handleGenerate}
                disabled={selectedIds.size < 2}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg transition-all ${selectedIds.size < 2 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-pink-900/20'}`}
             >
                 <Sparkles className="w-4 h-4" /> {t('createComposite')}
             </button>
        </div>

      </motion.div>
    </div>
  );
};