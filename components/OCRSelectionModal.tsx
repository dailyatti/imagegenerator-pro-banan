
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, FileText, Check, ScanText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ImageItem } from '../types';

interface OCRSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageItem[];
  onExtract: (selectedIds: string[]) => void;
}

export const OCRSelectionModal: React.FC<OCRSelectionModalProps> = ({ isOpen, onClose, images, onExtract }) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Select all by default when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(images.map(i => i.id)));
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

  const handleExtract = () => {
    onExtract(Array.from(selectedIds));
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
        className="relative bg-[#0f172a] border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-[#020617]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
                <ScanText className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white">{t('ocrTitle')}</h2>
                <p className="text-xs text-slate-400">{t('ocrDesc')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">{t('selectImages')} ({selectedIds.size})</h3>
            
            {/* Image Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map(img => {
                    const isSelected = selectedIds.has(img.id);
                    // Use processed URL if available to show what we are analyzing
                    const displayUrl = img.processedUrl || img.previewUrl;
                    
                    return (
                        <div 
                            key={img.id} 
                            onClick={() => toggleSelection(img.id)}
                            className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all group ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-800 hover:border-slate-600'}`}
                        >
                            <img src={displayUrl} alt="" className={`w-full h-full object-cover transition-all ${isSelected ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'}`} />
                            
                            <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-900/50 border border-slate-600'}`}>
                                {isSelected && <Check className="w-3 h-3" />}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-[#020617] flex justify-end gap-3">
             <button onClick={onClose} className="px-5 py-2.5 rounded-lg font-bold text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                 {t('cancel')}
             </button>
             <button 
                onClick={handleExtract}
                disabled={selectedIds.size === 0}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg transition-all ${selectedIds.size === 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'}`}
             >
                 <FileText className="w-4 h-4" /> {t('startExtraction')}
             </button>
        </div>

      </motion.div>
    </div>
  );
};
