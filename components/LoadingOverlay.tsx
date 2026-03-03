
import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, BrainCircuit, ScanLine, Cpu } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = "Processing..." }) => {
  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#020617]/90 backdrop-blur-md">
      
      {/* Central Neural Orb */}
      <div className="relative w-32 h-32 mb-8">
        {/* Outer Ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border border-slate-700 border-t-emerald-500 border-r-indigo-500 opacity-50"
        />
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-2 rounded-full border border-slate-700 border-b-purple-500 opacity-50"
        />
        
        {/* Core Pulse */}
        <div className="absolute inset-0 flex items-center justify-center">
             <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-indigo-600 rounded-full blur-xl opacity-50"
             />
             <div className="relative z-10 bg-slate-950 p-4 rounded-full border border-slate-700 shadow-2xl">
                 <BrainCircuit className="w-8 h-8 text-emerald-400" />
             </div>
        </div>

        {/* Orbiting Particles */}
        <motion.div 
           animate={{ rotate: 360 }}
           transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
           className="absolute inset-0"
        >
            <span className="absolute top-0 left-1/2 w-2 h-2 bg-emerald-400 rounded-full blur-[1px] shadow-[0_0_10px_#34d399]"></span>
        </motion.div>
      </div>

      {/* Text Content */}
      <div className="text-center space-y-2 relative z-10">
        <h3 className="text-2xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-indigo-400">
                AI Processing
            </span>
        </h3>
        
        <div className="flex flex-col items-center gap-1">
             <p className="text-slate-400 text-sm font-mono uppercase tracking-widest">{message}</p>
             <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, repeat: Infinity }}
                className="h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent w-48 mt-2"
             />
        </div>
      </div>

      {/* Background Grid Effect */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>
    </div>
  );
};
