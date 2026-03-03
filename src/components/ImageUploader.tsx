
import React, { useCallback, useState } from 'react';
import { Upload, Wand2, Plus, Image as ImageIcon, Copy, FileUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

interface ImageUploaderProps {
  onFilesSelected: (files: File[]) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onFilesSelected }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const imageFiles = Array.from(e.dataTransfer.files).filter((file: File) => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        onFilesSelected(imageFiles);
      }
    }
  }, [onFilesSelected]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Verify that the dragged item is valid to show correct cursor
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const imageFiles = Array.from(e.target.files).filter((file: File) => file.type.startsWith('image/'));
      onFilesSelected(imageFiles);
      
      // CRITICAL FIX: Reset the input value to allow selecting the exact same file again immediately
      e.target.value = '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className="w-full max-w-5xl mx-auto mb-12 relative group"
    >
        {/* Animated Glow Backdrop */}
        <div className={`absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-60 transition duration-1000 ${isDragging ? 'opacity-80 blur-md' : ''}`}></div>

        <div className={`
            relative bg-[#0f172a] border-2 border-dashed rounded-2xl h-80 flex flex-col items-center justify-center text-center transition-all duration-300 ease-out overflow-hidden cursor-pointer
            ${isDragging ? 'border-emerald-400 bg-slate-900/90 scale-[1.02] shadow-2xl shadow-emerald-500/10' : 'border-slate-700/50 hover:border-emerald-500/30 hover:bg-slate-900/60'}
        `}>
             <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
                onChange={handleFileInput}
            />

            {/* Grid Pattern Background */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="relative z-10 pointer-events-none flex flex-col items-center p-8">
                
                {/* Icon Container with Animation */}
                <div className={`
                    w-20 h-20 mb-8 rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-500
                    ${isDragging ? 'bg-emerald-500 rotate-12 scale-110' : 'bg-slate-800 border border-slate-700 group-hover:scale-110 group-hover:-rotate-3'}
                `}>
                    {isDragging ? (
                         <FileUp className="w-10 h-10 text-white animate-bounce" />
                    ) : (
                         <Upload className="w-10 h-10 text-emerald-400" />
                    )}
                </div>

                <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">
                    {isDragging ? "Drop assets here" : t('uploadTitle')}
                </h3>
                
                <p className="text-slate-400 text-lg mb-8 max-w-lg leading-relaxed">
                    Drag and drop your files, <span className="text-emerald-400 font-semibold border-b border-emerald-400/30">browse</span>, or 
                    <span className="inline-flex items-center gap-1.5 ml-2 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 text-slate-300 font-mono text-sm shadow-sm">
                        <Copy className="w-3.5 h-3.5" /> Ctrl + V
                    </span>
                    <br/> to paste directly from clipboard.
                </p>

                {/* Capability Badges */}
                <div className="flex flex-wrap justify-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-900/80 px-4 py-2 rounded-full border border-slate-800">
                         <ImageIcon className="w-3.5 h-3.5" /> <span>JPG, PNG, WEBP</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 bg-indigo-950/30 px-4 py-2 rounded-full border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                        <Wand2 className="w-3.5 h-3.5" /> <span>Gemini Vision Ready</span>
                    </div>
                </div>

            </div>
        </div>
    </motion.div>
  );
};
