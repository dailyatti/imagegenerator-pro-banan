
import React, { useRef, useState } from 'react';
import Cropper from 'react-cropper';
import { X, Check, RotateCw, ZoomIn, ZoomOut, Sparkles, Maximize, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LoadingOverlay } from './LoadingOverlay';
import { OutputFormat } from '../types';

interface ImageEditorProps {
  imageUrl: string;
  onSave: (newUrl: string, newBlob: Blob) => void;
  onClose: () => void;
  onGenerativeFill?: (imageBlob: Blob) => Promise<string>; // Returns new image URL
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onSave, onClose, onGenerativeFill }) => {
  const { t } = useTranslation();
  const cropperRef = useRef<HTMLImageElement>(null);
  const [cropper, setCropper] = useState<any>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const [hasGenerated, setHasGenerated] = useState(false);
  
  // Download config within editor
  const [downloadFormat, setDownloadFormat] = useState<OutputFormat>(OutputFormat.PNG);

  const handleSave = () => {
    if (typeof cropper !== 'undefined') {
      cropper.getCroppedCanvas({
          fillColor: '#ffffff' // Ensure transparent/empty areas are white for outpainting
      }).toBlob((blob: Blob | null) => {
        if (blob) {
          const newUrl = URL.createObjectURL(blob);
          onSave(newUrl, blob);
          onClose();
        }
      });
    }
  };

  const handleGenerativeFill = async () => {
      if (!onGenerativeFill || !cropper) return;
      
      setIsGenerating(true);
      try {
          // Get the canvas, filling the "outside" areas with white
          const canvas = cropper.getCroppedCanvas({
              fillColor: '#ffffff'
          });
          
          canvas.toBlob(async (blob: Blob | null) => {
              if (blob) {
                  try {
                      const newUrl = await onGenerativeFill(blob);
                      setCurrentImageUrl(newUrl); // Update editor with new image
                      cropper.replace(newUrl); // Reset cropper to new image
                      setHasGenerated(true);
                  } catch (e) {
                      console.error(e);
                  } finally {
                      setIsGenerating(false);
                  }
              }
          }, 'image/png');

      } catch (e) {
          setIsGenerating(false);
      }
  };

  const handleImmediateDownload = () => {
      if (cropper) {
          const canvas = cropper.getCroppedCanvas({ fillColor: '#ffffff' });
          const mimeType = downloadFormat;
          const dataUrl = canvas.toDataURL(mimeType, 0.95);
          
          const link = document.createElement('a');
          link.href = dataUrl;
          const ext = mimeType.split('/')[1];
          link.download = `banana_outpaint_${Date.now()}.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex flex-col"
    >
      {/* Loading Overlay */}
      {isGenerating && <LoadingOverlay message={t('generating')} />}

      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <h3 className="text-white font-bold flex items-center gap-2"><Maximize className="w-4 h-4 text-emerald-400"/> {t('edit')}</h3>
        <div className="flex gap-2">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-[#0f172a] p-8 flex items-center justify-center relative overflow-hidden">
         <div className="h-full w-full relative shadow-2xl border border-slate-800/50">
            <Cropper
                src={currentImageUrl}
                style={{ height: '100%', width: '100%' }}
                initialAspectRatio={NaN}
                guides={true}
                ref={cropperRef}
                onInitialized={(instance) => setCropper(instance)}
                background={true}
                viewMode={0} // Allows crop box to be outside the image
                dragMode="move"
                autoCropArea={0.8}
                checkOrientation={false}
            />
            
            {/* Outpainting Hint */}
            {!hasGenerated && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-2 rounded-full text-xs text-slate-300 pointer-events-none z-10 border border-white/10">
                    {t('outpaintDesc')}
                </div>
            )}
         </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-900 border-t border-slate-800">
          {/* Post-Generation Download Bar */}
          <AnimatePresence>
          {hasGenerated && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                className="bg-emerald-950/30 border-b border-emerald-900/30 px-6 py-3 flex items-center justify-between"
              >
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                      <Sparkles className="w-4 h-4" /> {t('fillComplete')}
                  </div>
                  <div className="flex items-center gap-2">
                      <select 
                        value={downloadFormat}
                        onChange={(e) => setDownloadFormat(e.target.value as OutputFormat)}
                        className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 outline-none"
                      >
                          <option value={OutputFormat.JPG}>JPG</option>
                          <option value={OutputFormat.PNG}>PNG</option>
                          <option value={OutputFormat.WEBP}>WEBP</option>
                      </select>
                      <button onClick={handleImmediateDownload} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-colors">
                          <Download className="w-3.5 h-3.5" /> {t('downloadResult')}
                      </button>
                  </div>
              </motion.div>
          )}
          </AnimatePresence>

          <div className="p-6 flex flex-wrap justify-center gap-4 sm:gap-6">
            <button onClick={() => cropper?.rotate(90)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors">
            <RotateCw className="w-5 h-5" /> <span className="text-[10px]">Rotate</span>
            </button>
            <button onClick={() => cropper?.zoom(0.1)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors">
            <ZoomIn className="w-5 h-5" /> <span className="text-[10px]">Zoom In</span>
            </button>
            <button onClick={() => cropper?.zoom(-0.1)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors">
            <ZoomOut className="w-5 h-5" /> <span className="text-[10px]">Zoom Out</span>
            </button>
            
            <div className="w-px bg-slate-700 mx-2 hidden sm:block"></div>
            
            {/* Generative Fill Button */}
            {onGenerativeFill && (
                <button 
                    onClick={handleGenerativeFill}
                    disabled={isGenerating}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all disabled:opacity-50"
                >
                    <Sparkles className="w-4 h-4" /> {t('genFill')}
                </button>
            )}

            <button 
                onClick={handleSave}
                className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg transition-all"
            >
                <Check className="w-4 h-4" /> {t('applyCrop')}
            </button>
          </div>
      </div>
    </motion.div>
  );
};
