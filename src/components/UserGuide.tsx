
import React from 'react';
import { X, BookOpen, Layers, Zap, Download, Monitor, Shirt, Sparkles } from 'lucide-react';

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuide: React.FC<UserGuideProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      
      <div className="relative bg-[#0f172a] border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-[#020617]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
                <BookOpen className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">System Documentation</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[70vh] space-y-8">
            
            <section>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    1. The Remastering Engine
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                    BananaAI is not a simple image resizer. It utilizes the <strong>Gemini 3 Pro Vision</strong> model to conceptually understand your image and <strong>regenerate</strong> it from scratch. This allows for:
                </p>
                <ul className="mt-2 space-y-1 ml-6 list-disc text-slate-400 text-sm">
                    <li><span className="text-slate-200">Outpainting:</span> Extending a square image to 16:9 by inventing new, context-aware scenery.</li>
                    <li><span className="text-slate-200">Upscaling:</span> Increasing resolution up to 4K while adding realistic textures.</li>
                    <li><span className="text-slate-200">Composition Correction:</span> Re-framing the subject for better aesthetic balance.</li>
                </ul>
            </section>
            
            <section>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    2. Native Generation & Workflow
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-2">
                    <strong>Non-Destructive Editing:</strong> When you process an image, the original file is preserved. The system creates a "Variant" card for the result. You can experiment endlessly without losing source files.
                </p>
                 <p className="text-slate-400 text-sm leading-relaxed">
                    <strong>Text-to-Image:</strong> Use the input bar below the uploader to generate high-fidelity assets from scratch using Gemini 3 Pro.
                </p>
            </section>

            <section>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-emerald-400" />
                    3. Print-on-Demand (POD)
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                    In the <strong>Composite Generator</strong>, switch to the "POD Templates" tab. You can merge your uploaded designs onto professional mockups (T-shirts, Mugs, Pillows) automatically. The AI handles the lighting and wrapping.
                </p>
            </section>

            <section>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    4. Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs font-bold text-emerald-400 uppercase">Aspect Ratio</span>
                        <p className="text-slate-400 text-xs mt-1">
                            Choose <strong>1:1</strong> for avatars, <strong>16:9</strong> for cinematic wallpapers, or <strong>9:16</strong> for mobile social content. The AI will intelligently fill the gaps.
                        </p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs font-bold text-emerald-400 uppercase">Resolution</span>
                        <p className="text-slate-400 text-xs mt-1">
                            Select <strong>4K</strong> for print/high-res displays. Note that higher resolutions require more processing time (approx. 10-20s).
                        </p>
                    </div>
                </div>
            </section>

             <section>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-400" />
                    5. Exporting
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                    Processed images are available for download in JPG, PNG, or WebP formats. The system handles the transcoding automatically after the AI generation is complete.
                </p>
            </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-[#020617] text-center">
             <p className="text-xs text-slate-500">
                 BananaAI Remaster SaaS v2.5 • Powered by Google DeepMind
             </p>
        </div>

      </div>
    </div>
  );
};
