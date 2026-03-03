
import React, { useState, useEffect } from 'react';
import { ImageItem, OutputFormat, AiResolution, AspectRatio, ProcessingStatus } from '../types';
import { formatBytes } from '../services/imageUtils';
import { Trash2, Download, AlertCircle, CheckCircle2, ScanLine, FileType, Monitor, Wand2, RefreshCw, PenTool, Type, Crop, Mic, Clock, Layers, RotateCcw, Share2, CopyPlus, MoreVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface ImageCardProps {
  item: ImageItem;
  onUpdateConfig: (id: string, updates: Partial<ImageItem>) => void;
  onProcess: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
  onMultiVariant?: (id: string, type: 'RATIOS' | 'FORMATS' | 'VARIANTS') => void;
}

// Processing Phase State
enum ProcessingPhase {
    SCANNING = 'SCANNING',
    GENERATING = 'GENERATING'
}

export const ImageCard: React.FC<ImageCardProps> = ({ item, onUpdateConfig, onProcess, onRemove, onEdit, onMultiVariant }) => {
  const { t } = useTranslation();
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>(ProcessingPhase.SCANNING);
  const [showMultiMenu, setShowMultiMenu] = useState(false);

  const isProcessing = item.status === ProcessingStatus.PROCESSING;
  const isSuccess = item.status === ProcessingStatus.SUCCESS;
  const isError = item.status === ProcessingStatus.ERROR;
  const isIdle = item.status === ProcessingStatus.IDLE;

  // Cinematic Animation Logic
  useEffect(() => {
      if (isProcessing) {
          setProcessingPhase(ProcessingPhase.SCANNING);
          const timer = setTimeout(() => {
              setProcessingPhase(ProcessingPhase.GENERATING);
          }, 3000); // Reduced to 3 seconds as requested
          return () => clearTimeout(timer);
      }
  }, [isProcessing]);

  const handleDownload = () => {
    if (item.processedUrl) {
      const link = document.createElement('a');
      link.href = item.processedUrl;
      const ext = item.targetFormat.split('/')[1];
      const filename = item.customOutputName && item.customOutputName.trim() !== '' 
        ? item.customOutputName 
        : `banana_remaster_${item.originalMeta.name.split('.')[0]}`;
      link.download = `${filename}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleConfigChange = (key: keyof ImageItem, value: any) => {
      onUpdateConfig(item.id, { [key]: value });
  };

  const startDictation = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.lang = 'en-US'; 
      recognition.start();
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleConfigChange('userPrompt', transcript);
      };
    } else {
      alert("Browser not supported.");
    }
  };

  const handleShare = async () => {
    if (!item.processedUrl) return;

    try {
        const response = await fetch(item.processedUrl);
        const blob = await response.blob();
        const ext = item.targetFormat.split('/')[1];
        const file = new File([blob], `image.${ext}`, { type: item.targetFormat });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'BananaAI Remaster',
                text: 'Check out this image I remastered with BananaAI!',
                files: [file]
            });
            toast.success('Shared successfully', { icon: '🚀', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
        } else {
            // Fallback to clipboard
            try {
                const clipboardItem = new ClipboardItem({ [item.targetFormat]: blob });
                await navigator.clipboard.write([clipboardItem]);
                toast.success('Image copied to clipboard!', { icon: '📋', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
            } catch (err) {
                 toast.error('Sharing not supported on this device', { style: { borderRadius: '10px', background: '#333', color: '#fff' } });
            }
        }
    } catch (error) {
        console.error("Share failed", error);
        toast.error('Failed to share image');
    }
  };

  return (
    <motion.div 
      layout
      className={`
        relative group rounded-2xl border transition-all duration-500 overflow-visible flex flex-col lg:flex-row z-0 hover:z-20
        ${isSuccess 
            ? 'bg-[#0f172a]/80 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.05)]' 
            : isProcessing
                ? 'bg-[#0f172a]/90 border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-2xl'
                : 'bg-[#0f172a]/60 border-slate-800 hover:border-slate-700 hover:shadow-xl hover:bg-[#0f172a]/80'
        }
    `}>
      
      {/* Remove Button */}
      <button onClick={() => onRemove(item.id)} className="absolute top-3 right-3 p-2 bg-slate-950/80 backdrop-blur text-slate-500 hover:text-red-400 rounded-lg z-30 opacity-0 group-hover:opacity-100 transition-all duration-200 border border-slate-800 hover:border-red-900/50">
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Duplicate/Variant Badge */}
      {item.duplicateIndex && (
          <div className="absolute top-3 right-14 bg-amber-500/20 backdrop-blur border border-amber-500/30 text-amber-400 text-[10px] font-bold px-2 py-1 rounded-md z-30 shadow-lg">
              {t('variant')} {item.duplicateIndex}
          </div>
      )}

      {/* Left: Image Preview Area */}
      <div className="w-full lg:w-[300px] h-80 lg:h-auto min-h-[320px] relative bg-[#020617] flex-shrink-0 lg:border-r border-b lg:border-b-0 border-slate-800 group-card overflow-hidden rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none">
         {/* Grid Pattern Background */}
         <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
         
         {/* Image */}
         <div className="absolute inset-0 flex items-center justify-center p-6">
             <motion.img 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               src={isSuccess && item.processedUrl ? item.processedUrl : item.previewUrl} 
               alt="Preview" 
               className={`max-w-full max-h-full object-contain shadow-2xl rounded-sm ${isProcessing ? 'blur-sm opacity-50 grayscale' : ''}`} 
             />
         </div>

         {/* PHD LEVEL PROCESSING OVERLAY - SCANNING BEAM */}
         {isProcessing && (
             <div className="absolute inset-0 z-20 overflow-hidden">
                 {/* Phase 1: Green Scanning Beam */}
                 {processingPhase === ProcessingPhase.SCANNING && (
                     <motion.div 
                        initial={{ top: '0%' }}
                        animate={{ top: '100%' }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_30px_#34d399] z-20"
                     />
                 )}
                 
                 {/* Phase 2: Purple Quantum Pulse */}
                 {processingPhase === ProcessingPhase.GENERATING && (
                     <div className="absolute inset-0 flex items-center justify-center">
                         <motion.div 
                            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.6, 0.2] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-32 h-32 bg-purple-500/30 rounded-full blur-xl"
                         />
                     </div>
                 )}

                 {/* Overlay Text */}
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-emerald-500/30 shadow-2xl">
                         <p className="text-emerald-400 font-mono text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                             <ScanLine className="w-3 h-3 animate-pulse" /> 
                             {processingPhase === ProcessingPhase.SCANNING ? "Scanning..." : "Generating..."}
                         </p>
                     </div>
                 </div>
             </div>
         )}
         
         {/* Edit Overlay */}
         {!isProcessing && (
             <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                <button onClick={() => onEdit(item.id)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 shadow-lg transform hover:scale-105 transition-all">
                    <Crop className="w-3.5 h-3.5" /> {t('edit')}
                </button>
             </div>
         )}

         {/* Status Badges */}
         <div className="absolute top-3 left-3 flex gap-2 z-10">
            {isSuccess && <div className="bg-emerald-500/20 backdrop-blur-md text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-emerald-500/30 shadow-lg"><CheckCircle2 className="w-3 h-3" /> {t('done')}</div>}
            {isError && <div className="bg-red-500/20 backdrop-blur-md text-red-400 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-red-500/30 shadow-lg"><AlertCircle className="w-3 h-3" /> {t('error')}</div>}
            {isIdle && <div className="bg-slate-800/80 backdrop-blur-md text-slate-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-700 flex items-center gap-1.5"><Clock className="w-3 h-3" /> {t('pending')}</div>}
         </div>
      </div>

      {/* Right: Controls Area */}
      <div className="flex-1 p-5 lg:p-6 flex flex-col relative">
        
        {/* Header Info */}
        <div className="flex items-start justify-between mb-6">
            <div>
                 <h3 className="text-slate-200 font-bold text-sm mb-1 truncate max-w-[200px]">{item.originalMeta.name}</h3>
                 <div className="flex items-center gap-3">
                   <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 uppercase tracking-wider font-semibold">{item.originalMeta.type.split('/')[1]}</span>
                   <span className="text-[10px] text-slate-500 font-mono">{formatBytes(item.originalMeta.size)}</span>
                 </div>
            </div>
            
            {/* Real Social Share Bar */}
            {isSuccess && (
                <div className="flex items-center gap-1">
                     <button onClick={handleShare} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all border border-slate-700 hover:border-indigo-500">
                        <Share2 className="w-3.5 h-3.5" /> {t('share')}
                     </button>
                </div>
            )}
        </div>

        {/* Controls Grid */}
        <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 transition-all duration-300 ${isProcessing ? 'opacity-60 grayscale pointer-events-none' : ''}`}>
            
            {/* Format */}
            <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold pl-1">{t('format')}</label>
                <div className="relative group/input">
                    <FileType className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within/input:text-emerald-400 transition-colors" />
                    <select value={item.targetFormat} onChange={(e) => handleConfigChange('targetFormat', e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer hover:border-slate-700">
                        <option value={OutputFormat.JPG}>JPG</option>
                        <option value={OutputFormat.PNG}>PNG</option>
                        <option value={OutputFormat.WEBP}>WEBP</option>
                    </select>
                </div>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold pl-1">{t('aspectRatio')}</label>
                <div className="relative group/input">
                    <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within/input:text-emerald-400 transition-colors" />
                    <select value={item.targetAspectRatio} onChange={(e) => handleConfigChange('targetAspectRatio', e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer hover:border-slate-700">
                        <option value={AspectRatio.SQUARE}>1:1 Square</option>
                        <option value={AspectRatio.LANDSCAPE}>16:9 Wide</option>
                        <option value={AspectRatio.PORTRAIT}>9:16 Tall</option>
                        <option value={AspectRatio.STANDARD_LANDSCAPE}>4:3 Photo</option>
                    </select>
                </div>
            </div>

            {/* Resolution */}
            <div className="space-y-1.5 col-span-2 md:col-span-1">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold pl-1">{t('resolution')}</label>
                <div className="relative group/input">
                    <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within/input:text-emerald-400 transition-colors" />
                    <select value={item.targetResolution} onChange={(e) => handleConfigChange('targetResolution', e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer hover:border-slate-700">
                        <option value={AiResolution.RES_1K}>1K (Fast)</option>
                        <option value={AiResolution.RES_2K}>2K (Balanced)</option>
                        <option value={AiResolution.RES_4K}>4K (Ultra)</option>
                    </select>
                </div>
            </div>
        </div>

        {/* Advanced Inputs */}
        <div className={`space-y-4 pt-4 border-t border-slate-800/50 flex-1 transition-all duration-300 ${isProcessing ? 'opacity-60 pointer-events-none' : ''}`}>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold pl-1">{t('filename')}</label>
                    <div className="relative group/input">
                         <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" />
                         <input type="text" value={item.customOutputName || ''} onChange={(e) => handleConfigChange('customOutputName', e.target.value)} placeholder={item.originalMeta.name.split('.')[0]} className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-700" />
                    </div>
                </div>
                
                {/* EXPANDABLE CREATIVE PROMPT INPUT - ANCHORED RIGHT FOR MOBILE */}
                <div className="space-y-1.5 relative z-20">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold pl-1">{t('creativePrompt')}</label>
                    <div className="relative group/input">
                        <PenTool className={`absolute left-3 top-3 w-3.5 h-3.5 transition-colors z-30 ${isPromptFocused ? 'text-purple-400' : 'text-slate-500'}`} />
                        
                        {/* Anchor right: 0 to prevent overflow on mobile when expanding */}
                        <AnimatePresence>
                        {isPromptFocused ? (
                            <motion.div 
                                initial={{ height: 38, width: '100%', opacity: 0 }} 
                                animate={{ height: 140, width: '300px', opacity: 1 }} 
                                exit={{ height: 38, width: '100%', opacity: 0 }}
                                className="absolute top-0 right-0 z-50 shadow-2xl origin-top-right max-w-[85vw]"
                            >
                                <textarea
                                    autoFocus
                                    value={item.userPrompt || ''}
                                    onChange={(e) => handleConfigChange('userPrompt', e.target.value)}
                                    onBlur={() => setIsPromptFocused(false)}
                                    placeholder="e.g. 'Cyberpunk style, more neon'"
                                    className="w-full h-full bg-slate-900 border border-purple-500 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none resize-none ring-1 ring-purple-500/30"
                                />
                            </motion.div>
                        ) : (
                             <input 
                                type="text" 
                                value={item.userPrompt || ''} 
                                onFocus={() => setIsPromptFocused(true)}
                                readOnly
                                placeholder="e.g. 'Cyberpunk style'" 
                                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-10 py-2.5 outline-none focus:border-purple-500/50 cursor-text hover:border-slate-600 transition-colors" 
                             />
                        )}
                        </AnimatePresence>
                        
                        {!isPromptFocused && (
                            <button onClick={startDictation} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded-md transition-all"><Mic className="w-3.5 h-3.5" /></button>
                        )}
                    </div>
                </div>
             </div>
        </div>

        {/* Action Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-end justify-between relative z-0">
            <div className="flex-1 mr-4">
                {isError ? (
                    <p className="text-xs text-red-400 flex items-center gap-2 font-medium"><AlertCircle className="w-3.5 h-3.5" /> {item.errorMessage || t('error')}</p>
                ) : isSuccess && item.processedMeta ? (
                    <div className="flex flex-col gap-1">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Result Stats</p>
                        <div className="flex items-center gap-3 text-xs font-mono text-emerald-400 bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-900/50 w-fit">
                             <span>{item.processedMeta.width}x{item.processedMeta.height}</span>
                             <span className="w-px h-3 bg-emerald-800"></span>
                             <span>{formatBytes(item.processedMeta.size)}</span>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                        {isProcessing ? <><span className="text-emerald-400 animate-pulse font-bold">{t('processing')}</span></> : <span>{t('ready')}</span>}
                    </p>
                )}
            </div>
            
            <div className="flex gap-2">
                {/* Multi-Gen Dropdown */}
                <div className="relative">
                    <button onClick={() => setShowMultiMenu(!showMultiMenu)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-3 rounded-xl transition-all border border-slate-700" title="Generate Multiple Variants">
                        <CopyPlus className="w-3.5 h-3.5" />
                    </button>
                    {showMultiMenu && (
                        <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                            <button onClick={() => { onMultiVariant && onMultiVariant(item.id, 'RATIOS'); setShowMultiMenu(false); }} className="w-full text-left px-4 py-3 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors border-b border-slate-800">
                                {t('genAllRatios')}
                            </button>
                            <button onClick={() => { onMultiVariant && onMultiVariant(item.id, 'FORMATS'); setShowMultiMenu(false); }} className="w-full text-left px-4 py-3 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors border-b border-slate-800">
                                {t('genAllFormats')}
                            </button>
                            <button onClick={() => { onMultiVariant && onMultiVariant(item.id, 'VARIANTS'); setShowMultiMenu(false); }} className="w-full text-left px-4 py-3 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
                                {t('gen3Variants')}
                            </button>
                        </div>
                    )}
                </div>

                {(!isSuccess || isIdle) ? (
                    <button onClick={() => onProcess(item.id)} disabled={isProcessing} className={`relative overflow-hidden flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all transform active:scale-95 ${isProcessing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white hover:bg-slate-100 text-slate-950 hover:shadow-emerald-500/20'}`}>
                        {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                        <span>{isSuccess ? 'Redo' : t('remaster')}</span>
                    </button>
                ) : (
                    // Show Redo option
                     <button onClick={() => onProcess(item.id)} className="px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700">
                        <RotateCcw className="w-3.5 h-3.5" />
                     </button>
                )}

                {isSuccess && (
                    <button onClick={handleDownload} className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 transition-all transform active:scale-95">
                        <Download className="w-3.5 h-3.5" /> <span>{t('export')}</span>
                    </button>
                )}
            </div>
        </div>

      </div>
    </motion.div>
  );
};
