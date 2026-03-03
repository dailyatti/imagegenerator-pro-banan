
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Loader2, Sparkles } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { ImageItem } from '../types';

interface VoiceAssistantProps {
  onCommand: (command: any) => void;
  onAudit: () => void;
  onApplyAll: () => void;
  currentLanguage: string;
  images?: ImageItem[];
  batchCompleteTrigger?: number;
  nativePrompt?: string;
  isNativeGenerating?: boolean;
  modalsState?: { composite: boolean; ocr: boolean; guide: boolean; langMenu?: boolean };
}

// Audio Decoding for Gemini Live (PCM 16le -> AudioBuffer)
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Helper to decode base64
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to encode base64
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Create PCM Blob for sending to API with DYNAMIC Sample Rate
function createBlob(data: Float32Array, sampleRate: number): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    // CRITICAL FIX: Send the ACTUAL sample rate to Gemini, not a hardcoded 16000
    mimeType: `audio/pcm;rate=${sampleRate}`,
  };
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ 
    onCommand, 
    onAudit, 
    onApplyAll, 
    currentLanguage, 
    images = [], 
    batchCompleteTrigger = 0,
    nativePrompt = '',
    isNativeGenerating = false,
    modalsState = { composite: false, ocr: false, guide: false, langMenu: false }
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [volume, setVolume] = useState(0);

  // Audio Contexts and Streams
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Nodes for cleanup
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Audio Scheduling
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Session Management
  const sessionRef = useRef<any>(null);

  // ANNOUNCE BATCH COMPLETION
  useEffect(() => {
      if (batchCompleteTrigger > 0 && sessionRef.current) {
          sessionRef.current.then((session: any) => {
              session.sendToolResponse({
                  functionResponses: {
                      name: 'system_announcement_trigger',
                      id: 'batch-complete-' + Date.now(),
                      response: { 
                          result: currentLanguage === 'hu' 
                            ? "A kötegelt generálás befejeződött. Jelentsd be a felhasználónak." 
                            : "Batch processing complete. Announce this to the user." 
                      }
                  }
              });
          });
      }
  }, [batchCompleteTrigger, currentLanguage]);

  const stopSession = () => {
    sessionRef.current = null;

    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    if (inputAudioContextRef.current) {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }
    
    sourcesRef.current.forEach(source => {
        try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    setIsActive(false);
    setIsConnecting(false);
    setVolume(0);
  };

  const generateStateReport = () => {
      return `
      [SYSTEM STATE SNAPSHOT]
      - Current Interface Language: ${currentLanguage} (Codes: en, hu, de, etc.)
      - Native Gen Input: "${nativePrompt || ''}"
      - Modals Open: Composite=${modalsState.composite}, OCR=${modalsState.ocr}, Docs=${modalsState.guide}, LangMenu=${modalsState.langMenu}
      - Images in Queue: ${images.length}
      `;
  };

  const getSystemInstruction = () => {
      const isHu = currentLanguage === 'hu';
      
      if (isHu) {
          return `
          SZEREPLŐ: BananaAI Rendszergazda és Profi Prompt Mérnök.
          FELADAT: A felhasználói utasítások AZONNALI, KÉRDÉS NÉLKÜLI végrehajtása.
          
          FONTOS SZABÁLYOK:
          
          1. NYELVVÁLTÁS (Szigorú Kódolás):
             - Ha a felhasználó nyelvet vált (pl. "Legyen angol", "Válts magyarra"), használd a 'manage_ui_state' eszközt 'CHANGE_LANG' akcióval.
             - ÉRTÉKEK: 
               - "Magyar" -> 'hu' (KÖTELEZŐEN kisbetűs kód!)
               - "Angol" -> 'en'
               - "Német" -> 'de'
             - SOHA ne küldd a teljes nevet (pl. "Hungarian"), CSAK a kódot ('hu').

          2. KÉPGENERÁLÁS (Extrém Engedelmesség):
             - TRIGGEREK: "Generáld le", "Nyomd meg a gombot", "Mehet", "Csináld", "Start", "Készítsd el".
             - AKCIÓ: Ha ezeket hallod, AZONNAL hívd meg a 'trigger_native_generation' eszközt.
             - PROMPT BŐVÍTÉS: Ha a felhasználó rövid leírást ad (pl. "egy kutya"), te bővítsd ki profi angol leírássá ("Cinematic shot of a dog..."), és ezt küldd el a 'trigger_native_generation' prompt paraméterében.
             - NE KÉRDEZZ VISSZA ("Biztosan?"). Csináld.

          3. MINDENT LÁTÓ SZEM:
             - Használd a 'get_system_state'-et, ha nem tudod, mi van a képernyőn.
          `;
      } else {
          return `
          ROLE: BananaAI System Admin & Expert Prompt Engineer.
          TASK: Execute user commands IMMEDIATELY with ZERO hesitation.
          
          CRITICAL PROTOCOLS:
          
          1. LANGUAGE SWITCHING (Strict ISO Codes):
             - Command: "Switch to Hungarian", "Change language to English".
             - Tool: 'manage_ui_state' -> action: 'CHANGE_LANG'.
             - MAPPING:
               - "Hungarian" -> 'hu' (MUST use code!)
               - "English" -> 'en'
               - "German" -> 'de'
             - NEVER send full names like "Hungarian".

          2. IMAGE GENERATION (Atomic Execution):
             - TRIGGERS: "Generate it", "Press the button", "Go", "Start", "Do it".
             - ACTION: IMMEDIATELY call 'trigger_native_generation'.
             - PROMPT EXPANSION: If user says "a cat", you MUST expand it to "Cinematic, photorealistic cat, 8k lighting..." inside the tool call.
             - DO NOT ASK for confirmation. Just execute.

          3. CONTEXT AWARENESS:
             - Use 'get_system_state' to see active modals or input text.
          `;
      }
  };

  const sendVisualContext = async (session: any) => {
      if (!images || images.length === 0) return;
      
      const visualBatch = images.slice(0, 3);
      for (const img of visualBatch) {
          try {
              const image = new Image();
              image.src = img.previewUrl;
              await new Promise((resolve) => { image.onload = resolve; });
              
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const MAX_SIZE = 1024; 
              let width = image.width;
              let height = image.height;
              
              if (width > height) {
                  if (width > MAX_SIZE) {
                      height *= MAX_SIZE / width;
                      width = MAX_SIZE;
                  }
              } else {
                  if (height > MAX_SIZE) {
                      width *= MAX_SIZE / height;
                      height = MAX_SIZE;
                  }
              }
              
              canvas.width = width;
              canvas.height = height;
              
              if (ctx) {
                  ctx.imageSmoothingEnabled = true;
                  ctx.imageSmoothingQuality = 'high';
                  ctx.drawImage(image, 0, 0, width, height);
                  const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                  
                  session.sendRealtimeInput({
                      media: {
                          mimeType: 'image/jpeg',
                          data: base64
                      }
                  });
              }
          } catch (e) {
              console.error("Failed to send visual context frame", e);
          }
      }
      
      session.sendToolResponse({
        functionResponses: {
            name: 'request_visual_context',
            id: 'visual-context-sent', 
            response: { result: `Visual context sent for ${visualBatch.length} images.` }
        }
      });
  };

  const startSession = async () => {
    if (isActive) return;
    setIsConnecting(true);

    try {
       const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
       
       const tools = [{
         functionDeclarations: [
           {
             name: 'get_system_state',
             description: 'Returns the current UI state (images, modals, input text). Use this to "see" the screen.',
             parameters: { type: Type.OBJECT, properties: {} }
           },
           {
             name: 'scroll_viewport',
             description: 'Scrolls the page.',
             parameters: {
                 type: Type.OBJECT,
                 properties: {
                     direction: { type: Type.STRING, enum: ['UP', 'DOWN', 'TOP', 'BOTTOM'], description: 'Direction to scroll.' }
                 },
                 required: ['direction']
             }
           },
           {
             name: 'update_dashboard',
             description: 'Updates existing images config in the queue (bulk or specific).',
             parameters: {
               type: Type.OBJECT,
               properties: {
                 aspectRatio: { type: Type.STRING, enum: ['1:1', '16:9', '9:16', '4:3', '3:4'] },
                 resolution: { type: Type.STRING, enum: ['1K', '2K', '4K'] },
                 format: { type: Type.STRING, enum: ['JPG', 'PNG', 'WEBP'] },
                 namingPattern: { type: Type.STRING, enum: ['ORIGINAL', 'RANDOM', 'SEQUENTIAL'] },
                 prompt: { type: Type.STRING },
                 targetIndex: { type: Type.STRING }
               }
             }
           },
           {
             name: 'update_native_input',
             description: 'Types text into the native generator bar or changes its settings.',
             parameters: {
               type: Type.OBJECT,
               properties: {
                 prompt: { type: Type.STRING },
                 aspectRatio: { type: Type.STRING, enum: ['1:1', '16:9', '9:16'] },
                 resolution: { type: Type.STRING, enum: ['1K', '2K', '4K'] },
                 format: { type: Type.STRING, enum: ['JPG', 'PNG', 'WEBP'] }
               }
             }
           },
           {
             name: 'trigger_native_generation',
             description: 'PRESSES THE GENERATE BUTTON. Can optionally override prompt and settings immediately.',
             parameters: { 
                 type: Type.OBJECT, 
                 properties: {
                     prompt: { type: Type.STRING, description: "The FULL, professionally enhanced prompt to generate." },
                     aspectRatio: { type: Type.STRING },
                     resolution: { type: Type.STRING },
                     format: { type: Type.STRING }
                 } 
             }
           },
           {
             name: 'perform_item_action',
             description: 'Performs specific actions on single images in the queue.',
             parameters: {
                 type: Type.OBJECT,
                 properties: {
                     action: { type: Type.STRING, enum: ['REMOVE', 'EDIT', 'DOWNLOAD', 'REMASTER', 'CREATE_VARIANTS', 'SHARE'] },
                     targetIndex: { type: Type.STRING, description: "1-based index of the image." }
                 },
                 required: ['action', 'targetIndex']
             }
           },
           {
             name: 'apply_settings_globally',
             description: 'Applies global settings to all images.',
             parameters: { type: Type.OBJECT, properties: {} }
           },
           {
               name: 'start_processing_queue',
               description: 'Starts processing all pending images.',
               parameters: { type: Type.OBJECT, properties: {} }
           },
           {
               name: 'analyze_images',
               description: 'Runs OCR analysis.',
               parameters: { type: Type.OBJECT, properties: {} }
           },
           {
               name: 'request_visual_context',
               description: 'Asks to SEE the images (pixels).',
               parameters: { type: Type.OBJECT, properties: {} }
           },
           {
               name: 'manage_ui_state',
               description: 'Opens modals, menus or CHANGES LANGUAGE.',
               parameters: {
                   type: Type.OBJECT,
                   properties: {
                       action: { type: Type.STRING, enum: ['OPEN_COMPOSITE', 'OPEN_OCR', 'OPEN_DOCS', 'CHANGE_LANG', 'OPEN_LANG_MENU'] },
                       value: { type: Type.STRING, description: "For CHANGE_LANG, pass the ISO code (e.g. 'hu', 'en')." }
                   }
               }
           },
           {
               name: 'manage_queue_actions',
               description: 'Global queue actions (Clear All, Download All).',
               parameters: {
                   type: Type.OBJECT,
                   properties: {
                       action: { type: Type.STRING, enum: ['CLEAR_ALL', 'DOWNLOAD_ZIP'] }
                   }
               }
           }
         ]
       }];

       // CRITICAL FIX: Do NOT set sampleRate: 16000. Use system default to prevent AudioContext errors.
       const inputAudioContext = new (window.AudioContext || window.webkitAudioContext)();
       inputAudioContextRef.current = inputAudioContext;

       const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
       audioContextRef.current = audioContext;
       const outputNode = audioContext.createGain();
       outputNode.connect(audioContext.destination);

       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
       streamRef.current = stream;

       const analyzer = inputAudioContext.createAnalyser();
       const visualizerSource = inputAudioContext.createMediaStreamSource(stream);
       visualizerSource.connect(analyzer);
       
       const updateVolume = () => {
         if (inputAudioContext.state === 'closed') return;
         const dataArray = new Uint8Array(analyzer.frequencyBinCount);
         analyzer.getByteFrequencyData(dataArray);
         const avg = dataArray.reduce((a,b) => a+b) / dataArray.length;
         setVolume(avg);
         requestAnimationFrame(updateVolume);
       };
       updateVolume();

       const sessionPromise = ai.live.connect({
         model: 'gemini-2.5-flash-native-audio-preview-09-2025',
         config: {
           tools: tools,
           systemInstruction: getSystemInstruction(),
           responseModalities: [Modality.AUDIO],
         },
         callbacks: {
            onopen: () => {
                setIsActive(true);
                setIsConnecting(false);
                
                // Send initial state
                sessionPromise.then(s => {
                    s.sendToolResponse({
                        functionResponses: {
                            name: 'system_state_report',
                            id: 'init-state-' + Date.now(),
                            response: { result: generateStateReport() }
                        }
                    });
                }).catch(() => {}); 

                // Process Input Audio
                const source = inputAudioContext.createMediaStreamSource(stream);
                sourceRef.current = source;
                
                // Use ScriptProcessor for capturing raw PCM
                const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                processorRef.current = scriptProcessor;
                
                scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                    const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                    // Pass current hardware sample rate to the blob creator
                    const pcmBlob = createBlob(inputData, inputAudioContext.sampleRate);
                    sessionPromise.then((session) => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    });
                };
                
                source.connect(scriptProcessor);
                scriptProcessor.connect(inputAudioContext.destination);
                
                sessionRef.current = sessionPromise;
            },
            onmessage: async (message: LiveServerMessage) => {
                if (message.toolCall) {
                    setIsExecuting(true); 
                    const functionResponses = [];
                    for (const fc of message.toolCall.functionCalls) {
                        const args = fc.args as any;
                        let result: { ok: boolean; message?: string } = { ok: true };
                        
                        if (fc.name === 'get_system_state') {
                            result = { ok: true, message: generateStateReport() };
                        }
                        else if (fc.name === 'scroll_viewport') {
                            onCommand({ scrollAction: args.direction });
                            result = { ok: true, message: `Scrolled ${args.direction}` };
                        }
                        else if (fc.name === 'update_dashboard') {
                            onCommand(args);
                            result = { ok: true, message: "Dashboard updated." };
                        } else if (fc.name === 'update_native_input') {
                            onCommand({ updateNative: true, ...args });
                            result = { ok: true, message: "Native input updated." };
                        } else if (fc.name === 'trigger_native_generation') {
                            onCommand({ 
                                triggerNative: true, 
                                prompt: args.prompt, 
                                aspectRatio: args.aspectRatio,
                                resolution: args.resolution,
                                format: args.format
                            });
                            result = { ok: true, message: "Generation started successfully." };
                        } else if (fc.name === 'perform_item_action') {
                            onCommand({ 
                                itemAction: args.action, 
                                targetIndex: args.targetIndex 
                            });
                            result = { ok: true, message: `Action ${args.action} performed on item ${args.targetIndex}.` };
                        } else if (fc.name === 'apply_settings_globally') {
                            onApplyAll();
                            result = { ok: true, message: "Applied globally." };
                        } else if (fc.name === 'start_processing_queue') {
                             onCommand({ startQueue: true });
                             result = { ok: true, message: "Queue started." };
                        } else if (fc.name === 'analyze_images') {
                            onAudit();
                            result = { ok: true, message: "Audit running." };
                        } else if (fc.name === 'request_visual_context') {
                            sessionPromise.then(s => sendVisualContext(s));
                            continue;
                        } else if (fc.name === 'manage_ui_state') {
                            onCommand({ uiAction: args.action, value: args.value });
                            result = { ok: true, message: `UI State updated: ${args.action} -> ${args.value}` };
                        } else if (fc.name === 'manage_queue_actions') {
                            onCommand({ queueAction: args.action });
                            result = { ok: true, message: "Queue action executed." };
                        }

                        functionResponses.push({
                            id: fc.id,
                            name: fc.name,
                            response: { result }
                        });
                    }
                    
                    if (functionResponses.length > 0) {
                        sessionPromise.then(s => s.sendToolResponse({ functionResponses }));
                    }
                    setTimeout(() => setIsExecuting(false), 500);
                }

                const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (base64Audio) {
                    try {
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
                        const source = audioContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputNode);
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(source);
                        source.onended = () => sourcesRef.current.delete(source);
                    } catch (e) {}
                }
            },
            onclose: stopSession,
            onerror: stopSession
         }
       });

    } catch (e) {
        console.error(e);
        setIsConnecting(false);
    }
  };

  return (
    <>
        <motion.div 
            drag
            dragMomentum={false}
            className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
        >
            {isActive && (
                <div className="flex flex-col gap-2 items-end">
                    {isExecuting && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-purple-900/80 backdrop-blur-md border border-purple-500/30 text-purple-200 text-xs px-3 py-1.5 rounded-full shadow-xl flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-purple-400 animate-spin" />
                            Processing Command...
                        </motion.div>
                    )}
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs px-3 py-1.5 rounded-full shadow-xl flex items-center gap-2">
                       <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                       Connected ({Math.round(volume)}%)
                    </motion.div>
                </div>
            )}

            <button
                onClick={isActive ? stopSession : startSession}
                className={`
                    relative w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all
                    ${isActive 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : isConnecting 
                            ? 'bg-slate-700' 
                            : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:scale-110'
                    }
                `}
            >
                {isActive && (
                    <div className="absolute inset-0 rounded-full border-2 border-white/30" style={{ transform: `scale(${1 + volume/100})` }}></div>
                )}
                {!isActive && !isConnecting && (
                    <div className="absolute inset-0 rounded-full bg-emerald-500/30 voice-pulse -z-10"></div>
                )}
                {isConnecting ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : isActive ? <Mic className="w-8 h-8 text-white" /> : <MicOff className="w-8 h-8 text-white/80" />}
            </button>
        </motion.div>
    </>
  );
};
