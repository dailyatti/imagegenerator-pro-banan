
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import i18next, { SUPPORTED_LANGUAGES } from './services/translations';
import { Toaster, toast } from 'react-hot-toast';

import { ImageUploader } from './components/ImageUploader';
import { ImageCard } from './components/ImageCard';
import { UserGuide } from './components/UserGuide';
import { ImageEditor } from './components/ImageEditor';
import { VoiceAssistant } from './components/VoiceAssistant';
import { CompositeModal } from './components/CompositeModal';
import { OCRSelectionModal } from './components/OCRSelectionModal';
import { TextToImageBar } from './components/TextToImageBar';

import { ImageItem, OutputFormat, AiResolution, ProcessingStatus, AspectRatio, NamingPattern } from './types';
import { getImageDimensions, fileToBase64 } from './services/imageUtils';
import { processImageWithGemini, extractTextFromImages, processCompositeGeneration, processGenerativeFill, generateImageFromText } from './services/geminiService';
import { loadSessionImages, saveSessionImages } from './services/storageService';

import { Loader2, Download, Sparkles, Lock, Wand2, BookOpen, PenTool, Layers, CopyCheck, BrainCircuit, ChevronDown, ClipboardCopy, PlusSquare, FileText, X, Copy, Check, Trash2, Keyboard, Globe, Layout } from 'lucide-react';

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(true);

  const [images, setImages] = useState<ImageItem[]>([]);
  const [globalProcessing, setGlobalProcessing] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [batchCompleteTrigger, setBatchCompleteTrigger] = useState(0);
  
  // Modals
  const [isCompositeModalOpen, setIsCompositeModalOpen] = useState(false);
  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false);

  // Bulk settings
  const [bulkFormat, setBulkFormat] = useState<OutputFormat>(OutputFormat.JPG);
  const [bulkRes, setBulkRes] = useState<AiResolution>(AiResolution.RES_2K);
  const [bulkAspect, setBulkAspect] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [globalPrompt, setGlobalPrompt] = useState<string>('');
  const [namingPattern, setNamingPattern] = useState<NamingPattern>(NamingPattern.ORIGINAL);
  
  // Native Gen State (Lifted)
  const [nativePrompt, setNativePrompt] = useState('');
  const [nativeConfig, setNativeConfig] = useState({
      format: OutputFormat.JPG,
      resolution: AiResolution.RES_2K,
      aspectRatio: AspectRatio.SQUARE
  });
  
  // UI States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [isTextCopied, setIsTextCopied] = useState(false);
  
  const [isApplied, setIsApplied] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  
  const [isGeneratingNative, setIsGeneratingNative] = useState(false);

  // Load Session on Mount
  useEffect(() => {
      const init = async () => {
          try {
              const saved = await loadSessionImages();
              if (saved && saved.length > 0) {
                  setImages(saved);
                  toast.success(`Session restored: ${saved.length} images loaded.`, { id: 'session-restore', icon: '🔄', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
              }
          } catch (e) {
              console.error("Failed to restore session", e);
          } finally {
              setIsRestored(true);
          }
      };
      if (hasKey) init();
  }, [hasKey]);

  // Auto-Save Session on Change
  useEffect(() => {
      if (isRestored && images.length > 0) {
          const timer = setTimeout(() => {
              saveSessionImages(images).catch(e => console.error("Auto-save failed", e));
          }, 1000); // Debounce save
          return () => clearTimeout(timer);
      }
  }, [images, isRestored]);


  // Close lang menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
            setIsLangMenuOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const checkKey = async () => {
      try {
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          const has = await window.aistudio.hasSelectedApiKey();
          setHasKey(has);
        } else if (process.env.API_KEY) {
          setHasKey(true);
        }
      } catch (e) { console.error(e); } finally { setIsCheckingKey(false); }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      try { await window.aistudio.openSelectKey(); setHasKey(true); } catch (e) { setHasKey(false); }
    }
  };

  const handleLanguageChange = (code: string) => {
    if (!code) return;
    
    // Normalize code if full name passed by AI
    let validCode = code.toLowerCase();
    if (validCode.includes('hungarian') || validCode.includes('magyar')) validCode = 'hu';
    else if (validCode.includes('english')) validCode = 'en';
    else if (validCode.includes('german')) validCode = 'de';
    
    // Check against supported list
    const isSupported = SUPPORTED_LANGUAGES.some(l => l.code === validCode);
    if (!isSupported) validCode = 'en'; // Fallback

    i18n.changeLanguage(validCode);
    localStorage.setItem('language', validCode);
    setIsLangMenuOpen(false);
    toast.success(`Language changed to ${validCode.toUpperCase()}`, { position: 'top-right', icon: '🌐', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
  };

  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newItems: ImageItem[] = [];
    const fileSignatures = new Map<string, number>();
    
    setImages(currentImages => {
        currentImages.forEach(img => {
            const sig = `${img.originalMeta.name}-${img.originalMeta.size}`;
            const count = fileSignatures.get(sig) || 0;
            fileSignatures.set(sig, count + 1);
        });
        return currentImages;
    });

    for (const file of files) {
      let width = 0;
      let height = 0;
      try {
        const dims = await getImageDimensions(file);
        width = dims.width;
        height = dims.height;
      } catch (e) { 
        console.warn("Could not extract image dimensions, using defaults", e);
      }

      const sig = `${file.name}-${file.size}`;
      const existingCount = fileSignatures.get(sig) || 0;
      fileSignatures.set(sig, existingCount + 1);
      
      const duplicateIndex = existingCount > 0 ? existingCount + 1 : undefined;

      const id = uuidv4();
      newItems.push({
        id,
        file,
        previewUrl: URL.createObjectURL(file),
        originalMeta: { name: file.name, size: file.size, width: width, height: height, type: file.type },
        targetFormat: bulkFormat,
        targetResolution: bulkRes,
        targetAspectRatio: bulkAspect,
        userPrompt: globalPrompt,
        status: ProcessingStatus.IDLE,
        duplicateIndex: duplicateIndex
      });
    }
    setImages(prev => [...prev, ...newItems]);
    toast.success(`${files.length} assets imported`, { id: 'import-success', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
  }, [bulkFormat, bulkRes, bulkAspect, globalPrompt]);

  // Global Paste Listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
        const clipboardItems = e.clipboardData?.items;
        if (!clipboardItems) return;

        const pastedFiles: File[] = [];
        let hasImage = false;

        for (let i = 0; i < clipboardItems.length; i++) {
            const item = clipboardItems[i];
            if (item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                if (blob) {
                    hasImage = true;
                    const fileName = blob.name === 'image.png' 
                        ? `clipboard_${Date.now()}.${blob.type.split('/')[1]}` 
                        : blob.name;
                    const file = new File([blob], fileName, { type: blob.type });
                    pastedFiles.push(file);
                }
            }
        }

        if (pastedFiles.length > 0) {
            e.preventDefault();
            setIsPasting(true);
            setTimeout(() => setIsPasting(false), 800);
            handleFilesSelected(pastedFiles);
        }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleFilesSelected]);


  const updateConfig = (id: string, updates: Partial<ImageItem>) => {
    setImages(prev => prev.map(img => {
        if (img.id === id) {
             let newStatus = img.status;
             if (img.status === ProcessingStatus.SUCCESS) {
                 newStatus = ProcessingStatus.IDLE;
             }
             return { ...img, ...updates, status: newStatus };
        }
        return img;
    }));
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    toast('Asset removed', { icon: '🗑️', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
  };

  const clearQueue = async () => {
      if (images.length === 0) return;
      setImages([]); 
      try {
          await saveSessionImages([]);
          toast('Queue cleared', { icon: '🗑️', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
      } catch (e) {
          console.error("Clear queue error", e);
      }
  };

  const handleMultiVariant = (id: string, type: 'RATIOS' | 'FORMATS' | 'VARIANTS') => {
      const originalItem = images.find(i => i.id === id);
      if (!originalItem) return;

      const newVariants: ImageItem[] = [];
      const baseIndex = originalItem.duplicateIndex || 1;
      
      if (type === 'RATIOS') {
          const ratios = [AspectRatio.SQUARE, AspectRatio.LANDSCAPE, AspectRatio.PORTRAIT];
          ratios.forEach((r, idx) => {
              newVariants.push({
                  ...originalItem,
                  id: uuidv4(),
                  targetAspectRatio: r,
                  status: ProcessingStatus.IDLE,
                  duplicateIndex: baseIndex + (idx + 1),
                  originalMeta: { ...originalItem.originalMeta, name: `${originalItem.originalMeta.name} (${r})` }
              });
          });
      } else if (type === 'FORMATS') {
          const formats = [OutputFormat.JPG, OutputFormat.PNG, OutputFormat.WEBP];
          formats.forEach((f, idx) => {
              newVariants.push({
                  ...originalItem,
                  id: uuidv4(),
                  targetFormat: f,
                  status: ProcessingStatus.IDLE,
                  duplicateIndex: baseIndex + (idx + 1),
                  originalMeta: { ...originalItem.originalMeta, name: `${originalItem.originalMeta.name} (${f.split('/')[1].toUpperCase()})` }
              });
          });
      } else if (type === 'VARIANTS') {
          for (let i = 0; i < 3; i++) {
              newVariants.push({
                  ...originalItem,
                  id: uuidv4(),
                  status: ProcessingStatus.IDLE,
                  duplicateIndex: baseIndex + (i + 1),
                  originalMeta: { ...originalItem.originalMeta, name: `${originalItem.originalMeta.name} (Var ${i+1})` }
              });
          }
      }

      setImages(prev => {
          const index = prev.findIndex(i => i.id === id);
          const newArr = [...prev];
          newArr.splice(index + 1, 0, ...newVariants);
          return newArr;
      });
      toast.success(`Created ${newVariants.length} queued variants`, { style: { borderRadius: '10px', background: '#333', color: '#fff' } });
  };

  const processSingleImage = async (id: string) => {
    const originalItem = images.find(i => i.id === id);
    if (!originalItem) return;

    const variantId = uuidv4();
    const variantItem: ImageItem = {
        ...originalItem,
        id: variantId,
        status: ProcessingStatus.PROCESSING,
        duplicateIndex: (originalItem.duplicateIndex || 1) + 1, 
        originalMeta: { ...originalItem.originalMeta, name: `${originalItem.originalMeta.name} (Processed)` }
    };
    
    setImages(prev => {
        const index = prev.findIndex(i => i.id === id);
        const newArr = [...prev];
        newArr.splice(index + 1, 0, variantItem);
        return newArr;
    });

    try {
        const result = await processImageWithGemini(variantItem);
        
        setImages(prev => prev.map(img => {
            if (img.id === variantId) {
                return {
                    ...img,
                    status: ProcessingStatus.SUCCESS,
                    processedUrl: result.processedUrl,
                    processedMeta: {
                        name: `remastered_${img.originalMeta.name}`,
                        size: result.size,
                        width: result.width,
                        height: result.height,
                        type: img.targetFormat
                    }
                };
            }
            return img;
        }));
        toast.success(`Variant created successfully!`, { style: { borderRadius: '10px', background: '#333', color: '#fff' } });
    } catch (error: any) {
        setImages(prev => prev.map(img => img.id === variantId ? { ...img, status: ProcessingStatus.ERROR, errorMessage: error.message } : img));
        toast.error(`Processing failed: ${error.message}`, { style: { borderRadius: '10px', background: '#333', color: '#fff' } });
    }
  };
  
  const handleNativeGen = async (overridePrompt?: string, overrideConfig?: any) => {
      // ATOMIC EXECUTION: Prioritize override values (from voice)
      const finalPrompt = overridePrompt || nativePrompt;
      const finalConfig = overrideConfig || nativeConfig;
      
      if (!finalPrompt || !finalPrompt.trim()) {
          toast.error("Prompt cannot be empty");
          return;
      }
      
      setIsGeneratingNative(true);
      
      // Sync visual state if driven by voice
      if (overridePrompt) setNativePrompt(overridePrompt); 
      if (overrideConfig) setNativeConfig(prev => ({ ...prev, ...overrideConfig }));

      // Show feedback
      toast("Generating...", { icon: '🎨', duration: 2000, style: { borderRadius: '10px', background: '#333', color: '#fff' } });

      const tempId = uuidv4();
      const placeholder: ImageItem = {
          id: tempId,
          file: new File([], 'native_gen', { type: 'image/png' }),
          previewUrl: '',
          originalMeta: { name: 'AI Generated Asset', size: 0, width: 0, height: 0, type: 'image/png' },
          targetFormat: finalConfig.format,
          targetResolution: finalConfig.resolution,
          targetAspectRatio: finalConfig.aspectRatio,
          userPrompt: finalPrompt,
          status: ProcessingStatus.PROCESSING
      };
      
      setImages(prev => [placeholder, ...prev]);
      
      try {
          const result = await generateImageFromText(finalPrompt, finalConfig);
          const resp = await fetch(result.processedUrl);
          const blob = await resp.blob();
          const file = new File([blob], `ai_gen_${Date.now()}.png`, { type: 'image/png' });
          
          setImages(prev => prev.map(img => {
              if (img.id === tempId) {
                  return {
                      ...img,
                      file: file,
                      previewUrl: result.processedUrl,
                      processedUrl: result.processedUrl,
                      status: ProcessingStatus.SUCCESS,
                      originalMeta: { name: `AI_Gen_${Date.now()}`, size: result.size, width: result.width, height: result.height, type: 'image/png' },
                      processedMeta: { name: `AI_Gen_${Date.now()}`, size: result.size, width: result.width, height: result.height, type: 'image/png' }
                  };
              }
              return img;
          }));
          toast.success("Image generated successfully!");
          // Keep prompt in box for reference
      } catch (e: any) {
          setImages(prev => prev.filter(img => img.id !== tempId));
          toast.error("Generation failed: " + e.message);
      } finally {
          setIsGeneratingNative(false);
      }
  };

  const processAll = async () => {
    const itemsToProcess = images.filter(i => i.status === ProcessingStatus.IDLE);
    if (itemsToProcess.length === 0) {
        toast('No pending items to process', { icon: 'ℹ️', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
        return;
    }
    
    setGlobalProcessing(true);
    toast.loading(`Starting batch queue (${itemsToProcess.length} items)...`, { id: 'batch-queue', duration: 2000, style: { borderRadius: '10px', background: '#333', color: '#fff' } });
    
    const promises = itemsToProcess.map(img => processSingleImage(img.id));
    await Promise.all(promises);
    
    setGlobalProcessing(false);
    toast.dismiss('batch-queue');
    toast.success('Batch processing complete!', { style: { borderRadius: '10px', background: '#333', color: '#fff' } });
    setBatchCompleteTrigger(prev => prev + 1);
  };

  const openCompositeModal = () => setIsCompositeModalOpen(true);

  const runCompositeGeneration = async (selectedIds: string[], prompt: string, config: any) => {
      setIsCompositeModalOpen(false);
      const compositeId = uuidv4();
      const selectedImages = images.filter(img => selectedIds.includes(img.id));
      if (selectedImages.length < 1) {
          toast.error("Select at least one image");
          return;
      }
      const placeholder: ImageItem = {
          id: compositeId,
          file: new File([], 'composite_gen', { type: 'image/png' }),
          previewUrl: '', 
          originalMeta: { name: 'Composite Generation', size: 0, width: 0, height: 0, type: 'image/png' },
          targetFormat: config.format,
          targetResolution: config.resolution,
          targetAspectRatio: config.aspectRatio,
          userPrompt: prompt || globalPrompt,
          status: ProcessingStatus.PROCESSING
      };
      setImages(prev => [placeholder, ...prev]);
      const toastId = toast.loading('Generating composite...', { id: 'composite-gen', style: { borderRadius: '10px', background: '#333', color: '#fff' } });

      try {
          const result = await processCompositeGeneration(selectedImages, prompt || globalPrompt, config);
          setImages(prev => prev.map(img => {
              if (img.id === compositeId) {
                  return {
                      ...img,
                      status: ProcessingStatus.SUCCESS,
                      previewUrl: result.processedUrl,
                      processedUrl: result.processedUrl,
                      processedMeta: {
                          name: `Composite_${Date.now()}`,
                          size: result.size,
                          width: result.width,
                          height: result.height,
                          type: config.format
                      }
                  };
              }
              return img;
          }));
          toast.dismiss(toastId);
          toast.success('Composite generated!');
      } catch (e: any) {
           setImages(prev => prev.map(img => img.id === compositeId ? { ...img, status: ProcessingStatus.ERROR, errorMessage: e.message } : img));
           toast.dismiss(toastId);
           toast.error('Composite failed');
      }
  };

  const openOCRModal = () => {
    if(images.length === 0) return;
    setIsOCRModalOpen(true);
  };

  const runOCR = async (selectedIds: string[]) => {
      setIsOCRModalOpen(false);
      const selectedImages = images.filter(img => selectedIds.includes(img.id));
      if (selectedImages.length === 0) return;
      setIsExtractingText(true);
      const toastId = toast.loading('Analyzing text structure...', { style: { borderRadius: '10px', background: '#333', color: '#fff' } });
      const report = await extractTextFromImages(selectedImages);
      setOcrText(report);
      setIsExtractingText(false);
      toast.dismiss(toastId);
      toast.success('Text extraction complete');
  };
  
  const copyOcrToClipboard = () => {
      if (ocrText) {
          navigator.clipboard.writeText(ocrText);
          setIsTextCopied(true);
          toast.success('Copied to clipboard');
          setTimeout(() => setIsTextCopied(false), 2000);
      }
  };

  const applyBulkSettings = () => {
      setImages(prev => prev.map(img => ({ ...img, targetFormat: bulkFormat, targetResolution: bulkRes, targetAspectRatio: bulkAspect, userPrompt: globalPrompt || img.userPrompt })));
      setIsApplied(true);
      toast.success('Global settings applied to all items');
      setTimeout(() => setIsApplied(false), 1500); 
  };

  // --- CENTRAL VOICE COMMAND DISPATCHER ---
  const handleVoiceCommand = (cmd: any) => {
      // 0. SCROLL ACTION
      if (cmd.scrollAction) {
          const direction = cmd.scrollAction;
          if (direction === 'TOP') window.scrollTo({ top: 0, behavior: 'smooth' });
          if (direction === 'BOTTOM') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          if (direction === 'UP') window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
          if (direction === 'DOWN') window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
          return;
      }

      // 1. TRIGGER NATIVE GEN (ATOMIC)
      if (cmd.triggerNative) {
          const configOverride: any = {};
          if (cmd.aspectRatio) configOverride.aspectRatio = cmd.aspectRatio;
          if (cmd.resolution) configOverride.resolution = cmd.resolution;
          if (cmd.format) {
              if (cmd.format === 'JPG') configOverride.format = OutputFormat.JPG;
              if (cmd.format === 'PNG') configOverride.format = OutputFormat.PNG;
              if (cmd.format === 'WEBP') configOverride.format = OutputFormat.WEBP;
          }
          handleNativeGen(cmd.prompt, Object.keys(configOverride).length ? configOverride : undefined);
          return;
      }

      // 2. UNIVERSAL ITEM ACTION (NEW)
      if (cmd.itemAction && cmd.targetIndex) {
          const idx = parseInt(cmd.targetIndex) - 1;
          if (idx >= 0 && idx < images.length) {
              const targetId = images[idx].id;
              switch(cmd.itemAction) {
                  case 'REMOVE': removeImage(targetId); break;
                  case 'EDIT': setEditingId(targetId); break;
                  case 'DOWNLOAD': 
                      // Trigger download for specific item
                      const link = document.createElement('a');
                      const item = images[idx];
                      if(item.processedUrl) {
                          link.href = item.processedUrl;
                          link.download = `download_${item.id}.${item.targetFormat.split('/')[1]}`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          toast.success(`Downloading item ${cmd.targetIndex}`);
                      } else {
                          toast.error(`Item ${cmd.targetIndex} is not ready.`);
                      }
                      break;
                  case 'REMASTER': processSingleImage(targetId); break;
                  case 'CREATE_VARIANTS': handleMultiVariant(targetId, 'VARIANTS'); break;
                  case 'SHARE':
                      // Share logic for specific item
                      const shareItem = images[idx];
                      if(shareItem.processedUrl) {
                          fetch(shareItem.processedUrl)
                            .then(r => r.blob())
                            .then(blob => {
                                const ext = shareItem.targetFormat.split('/')[1];
                                const file = new File([blob], `image.${ext}`, { type: shareItem.targetFormat });
                                if (navigator.share && navigator.canShare({ files: [file] })) {
                                    navigator.share({ files: [file] });
                                } else {
                                    toast.success('Copied to clipboard (Share not supported on this device)');
                                    const ci = new ClipboardItem({ [shareItem.targetFormat]: blob });
                                    navigator.clipboard.write([ci]);
                                }
                            });
                      }
                      break;
              }
          } else {
              toast.error(`Item ${cmd.targetIndex} not found.`);
          }
          return;
      }

      // 3. UI ACTIONS
      if (cmd.uiAction) {
          switch(cmd.uiAction) {
              case 'CHANGE_LANG': handleLanguageChange(cmd.value); break;
              case 'OPEN_LANG_MENU': setIsLangMenuOpen(true); break;
              case 'OPEN_COMPOSITE': setIsCompositeModalOpen(true); break;
              case 'OPEN_OCR': openOCRModal(); break;
              case 'OPEN_DOCS': setIsGuideOpen(true); break;
          }
          return;
      }

      // 4. GLOBAL QUEUE ACTIONS
      if (cmd.queueAction) {
          switch(cmd.queueAction) {
              case 'CLEAR_ALL': clearQueue(); break;
              case 'DOWNLOAD_ZIP': downloadAllProcessed(); break;
          }
          return;
      }

      // 5. NATIVE INPUT UPDATE
      if (cmd.updateNative) {
          if (cmd.prompt) {
              setNativePrompt(cmd.prompt);
              toast("AI Typing...", { icon: '⌨️', duration: 1000, style: { borderRadius: '10px', background: '#333', color: '#fff' } });
          }
          if (cmd.aspectRatio) setNativeConfig(prev => ({ ...prev, aspectRatio: cmd.aspectRatio }));
          if (cmd.resolution) setNativeConfig(prev => ({ ...prev, resolution: cmd.resolution }));
          if (cmd.format) {
              if (cmd.format === 'JPG') setNativeConfig(prev => ({ ...prev, format: OutputFormat.JPG }));
              if (cmd.format === 'PNG') setNativeConfig(prev => ({ ...prev, format: OutputFormat.PNG }));
              if (cmd.format === 'WEBP') setNativeConfig(prev => ({ ...prev, format: OutputFormat.WEBP }));
          }
          return;
      }

      // 6. LEGACY DASHBOARD UPDATE (For general 'update image 1' commands)
      const targetIndex = cmd.targetIndex ? parseInt(cmd.targetIndex) : 0;
      if (cmd.startQueue) { processAll(); return; }

      setImages(prevImages => {
          return prevImages.map((img, index) => {
              const isTarget = targetIndex === 0 || (index + 1) === targetIndex;
              if (!isTarget) return img;
              let updates: Partial<ImageItem> = {};
              if (cmd.aspectRatio) updates.targetAspectRatio = cmd.aspectRatio;
              if (cmd.resolution) updates.targetResolution = cmd.resolution;
              if (cmd.prompt) updates.userPrompt = cmd.prompt;
              if (cmd.format) {
                  if (cmd.format === 'JPG') updates.targetFormat = OutputFormat.JPG;
                  if (cmd.format === 'PNG') updates.targetFormat = OutputFormat.PNG;
                  if (cmd.format === 'WEBP') updates.targetFormat = OutputFormat.WEBP;
              }
              return { ...img, ...updates };
          });
      });

      if (targetIndex === 0) {
        if (cmd.aspectRatio) setBulkAspect(cmd.aspectRatio);
        if (cmd.resolution) setBulkRes(cmd.resolution);
        if (cmd.prompt) setGlobalPrompt(cmd.prompt);
        if (cmd.format) {
            if (cmd.format === 'JPG') setBulkFormat(OutputFormat.JPG);
            if (cmd.format === 'PNG') setBulkFormat(OutputFormat.PNG);
            if (cmd.format === 'WEBP') setBulkFormat(OutputFormat.WEBP);
        }
      }
  };

  const handleEditorSave = (newUrl: string, newBlob: Blob) => {
      if (!editingId) return;
      const originalItem = images.find(i => i.id === editingId);
      if(!originalItem) return;
      const variantId = uuidv4();
      const newItem: ImageItem = {
          ...originalItem,
          id: variantId,
          file: new File([newBlob], originalItem.originalMeta.name, { type: originalItem.originalMeta.type }),
          previewUrl: newUrl,
          status: ProcessingStatus.IDLE,
          duplicateIndex: (originalItem.duplicateIndex || 1) + 1
      };
      setImages(prev => {
           const index = prev.findIndex(i => i.id === editingId);
           const newArr = [...prev];
           newArr.splice(index + 1, 0, newItem);
           return newArr;
      });
      setEditingId(null);
      toast.success('Edited version saved as variant');
  };

  const handleGenerativeFill = async (blob: Blob): Promise<string> => {
      const toastId = toast.loading('Expanding Canvas...');
      try {
          const result = await processGenerativeFill(blob);
          toast.dismiss(toastId);
          toast.success('Outpainting Complete!');
          return result.processedUrl;
      } catch (e: any) {
          toast.dismiss(toastId);
          toast.error('Outpainting Failed');
          throw e;
      }
  };

  const downloadAllProcessed = async () => {
    const processedImages = images.filter(img => img.status === ProcessingStatus.SUCCESS && img.processedUrl);
    if (processedImages.length === 0) {
        toast.error("No finished images to download.");
        return;
    }
    toast.loading('Zipping files...', { id: 'zip-download' });
    const zip = new JSZip();
    processedImages.forEach((img, index) => {
        if (img.processedUrl) {
            let name = img.originalMeta.name.split('.')[0];
            if (img.customOutputName) name = img.customOutputName;
            if (namingPattern === NamingPattern.RANDOM_ID) name = uuidv4().slice(0,8);
            if (namingPattern === NamingPattern.SEQUENTIAL_PREFIX) name = `${String(index+1).padStart(2,'0')}_${name}`;
            if (namingPattern === NamingPattern.SEQUENTIAL_SUFFIX) name = `${name}_${String(index+1).padStart(2,'0')}`;
            const ext = img.targetFormat.split('/')[1];
            zip.file(`${name}.${ext}`, fetch(img.processedUrl).then(r => r.blob()));
        }
    });
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `BananaAI_Export_${new Date().getTime()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.dismiss('zip-download');
    toast.success('Download started');
  };

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];
  const originalCount = images.filter(i => !i.duplicateIndex || i.duplicateIndex === 1).length;
  const variantCount = images.filter(i => i.duplicateIndex && i.duplicateIndex > 1).length;

  if (isCheckingKey) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /></div>;

  if (!hasKey) {
      return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full"></div>
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 max-w-md w-full bg-slate-900/40 backdrop-blur-2xl border border-slate-800 rounded-3xl p-12 shadow-2xl text-center">
                 <Lock className="w-10 h-10 text-emerald-400 mx-auto mb-8" />
                 <h1 className="text-3xl font-bold text-white mb-3">{t('appTitle')}</h1>
                 <p className="text-slate-400 mb-8">{t('authDesc')}</p>
                 <button onClick={handleSelectKey} className="w-full bg-white hover:bg-slate-200 text-slate-950 font-bold text-lg py-4 rounded-xl transition-all shadow-lg transform active:scale-95">
                    {t('authenticate')}
                 </button>
             </motion.div>
        </div>
      );
  }

  return (
    <div className="min-h-screen text-slate-200 font-sans selection:bg-emerald-500/30 pb-20">
      <Toaster position="bottom-center" />
      
      <AnimatePresence>
          {isPasting && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-emerald-500/20 backdrop-blur-sm pointer-events-none flex items-center justify-center">
                  <div className="bg-slate-900/90 border border-emerald-500/50 px-8 py-4 rounded-2xl flex items-center gap-4 shadow-2xl transform scale-125">
                      <ClipboardCopy className="w-8 h-8 text-emerald-400" />
                      <span className="text-xl font-bold text-white tracking-wide">Image Pasted!</span>
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      <UserGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <AnimatePresence>{isCompositeModalOpen && (<CompositeModal isOpen={isCompositeModalOpen} onClose={() => setIsCompositeModalOpen(false)} images={images} onGenerate={runCompositeGeneration} />)}</AnimatePresence>
      <AnimatePresence>{isOCRModalOpen && (<OCRSelectionModal isOpen={isOCRModalOpen} onClose={() => setIsOCRModalOpen(false)} images={images} onExtract={runOCR} />)}</AnimatePresence>
      <AnimatePresence>{editingId && (<ImageEditor imageUrl={images.find(i => i.id === editingId)?.previewUrl || ''} onSave={handleEditorSave} onClose={() => setEditingId(null)} onGenerativeFill={handleGenerativeFill} />)}</AnimatePresence>

      <VoiceAssistant 
         onCommand={handleVoiceCommand} 
         onAudit={() => setIsOCRModalOpen(true)} 
         onApplyAll={applyBulkSettings}
         currentLanguage={i18n.language}
         images={images} 
         batchCompleteTrigger={batchCompleteTrigger}
         nativePrompt={nativePrompt}
         isNativeGenerating={isGeneratingNative}
         modalsState={{ composite: isCompositeModalOpen, ocr: isOCRModalOpen, guide: isGuideOpen, langMenu: isLangMenuOpen }}
      />

      <header className="bg-[#020617]/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
                <h1 className="text-lg font-bold text-white leading-none tracking-tight">{t('appTitle')}</h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.25em] font-bold mt-1.5">{t('subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="relative" ref={langMenuRef}>
                <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg px-3 py-2 transition-colors">
                    <span className="text-lg">{currentLang.flag}</span>
                    <span className="text-sm font-medium text-slate-300 hidden md:block">{currentLang.name}</span>
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>
                <AnimatePresence>
                {isLangMenuOpen && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full right-0 mt-2 w-56 max-h-80 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 scrollbar-thin">
                        {SUPPORTED_LANGUAGES.map((lang) => (
                            <button key={lang.code} onClick={() => handleLanguageChange(lang.code)} className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-800 transition-colors ${i18n.language === lang.code ? 'bg-slate-800 text-emerald-400' : 'text-slate-300'}`}>
                                <span className="text-lg">{lang.flag}</span>
                                <span>{lang.name}</span>
                                {i18n.language === lang.code && <Check className="w-3 h-3 ml-auto" />}
                            </button>
                        ))}
                    </motion.div>
                )}
                </AnimatePresence>
             </div>
             <button onClick={() => setIsGuideOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-sm font-medium transition-all">
                 <BookOpen className="w-4 h-4 text-indigo-400" />
                 <span className="hidden md:block">{t('docs')}</span>
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-4 tracking-tight leading-tight">{t('introTitle')}</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">{t('introDesc')}</p>
        </div>

        <ImageUploader onFilesSelected={handleFilesSelected} />
        <TextToImageBar 
            prompt={nativePrompt}
            config={nativeConfig}
            onPromptChange={setNativePrompt}
            onConfigChange={(key, val) => setNativeConfig(prev => ({ ...prev, [key]: val }))}
            onGenerate={handleNativeGen} 
            isGenerating={isGeneratingNative} 
        />

        <AnimatePresence>
        {images.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="sticky top-24 z-40 mb-10">
                <div className="bg-[#0f172a]/95 backdrop-blur-2xl rounded-2xl border border-slate-700/50 p-3 shadow-2xl flex flex-col xl:flex-row gap-4 max-w-[1400px] mx-auto">
                    
                    <div className="flex-1 bg-slate-950/50 rounded-xl border border-slate-800/50 p-3 flex flex-col md:flex-row gap-3 items-center relative">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest px-2">
                            <Layers className="w-4 h-4" /> {t('globalConfig')}
                        </div>
                        <div className="h-8 w-px bg-slate-800 hidden md:block"></div>
                        
                        <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
                             <select value={bulkFormat} onChange={(e) => setBulkFormat(e.target.value as OutputFormat)} className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2.5 outline-none focus:border-emerald-500/50 cursor-pointer">
                                <option value={OutputFormat.JPG}>JPG Output</option>
                                <option value={OutputFormat.PNG}>PNG Output</option>
                                <option value={OutputFormat.WEBP}>WEBP Output</option>
                            </select>
                            <select value={bulkAspect} onChange={(e) => setBulkAspect(e.target.value as AspectRatio)} className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2.5 outline-none focus:border-emerald-500/50 cursor-pointer">
                                <option value={AspectRatio.SQUARE}>1:1 Square</option>
                                <option value={AspectRatio.LANDSCAPE}>16:9 Wide</option>
                                <option value={AspectRatio.PORTRAIT}>9:16 Tall</option>
                            </select>
                            <select value={bulkRes} onChange={(e) => setBulkRes(e.target.value as AiResolution)} className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2.5 outline-none focus:border-emerald-500/50 cursor-pointer">
                                <option value={AiResolution.RES_1K}>1K Res</option>
                                <option value={AiResolution.RES_2K}>2K Res</option>
                                <option value={AiResolution.RES_4K}>4K Res</option>
                            </select>
                        </div>
                        
                        <div className="w-full relative flex-1 group">
                             <div className={`absolute top-0 left-0 transition-all duration-300 ease-in-out z-50 ${isPromptFocused ? 'h-36 w-[180%] md:w-[400px] shadow-2xl rounded-xl' : 'h-full w-full'}`}>
                                 <PenTool className={`w-3.5 h-3.5 text-slate-500 absolute left-3 top-3 z-30 transition-colors ${isPromptFocused ? 'text-purple-400' : ''}`} />
                                 {isPromptFocused ? (
                                     <textarea 
                                        autoFocus
                                        value={globalPrompt}
                                        onChange={(e) => setGlobalPrompt(e.target.value)}
                                        onBlur={() => setIsPromptFocused(false)}
                                        placeholder={t('creativePrompt')}
                                        className="w-full h-full bg-slate-900 border border-purple-500 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none resize-none shadow-lg ring-1 ring-purple-500/30"
                                     />
                                 ) : (
                                     <input 
                                        type="text" 
                                        value={globalPrompt} 
                                        onFocus={() => setIsPromptFocused(true)}
                                        readOnly
                                        placeholder={t('creativePrompt')} 
                                        className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none focus:border-purple-500/50 cursor-text" 
                                    />
                                 )}
                             </div>
                             <div className="h-[34px] w-full"></div>
                        </div>

                        <button onClick={applyBulkSettings} className={`w-full md:w-auto px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-2 whitespace-nowrap z-10 ${isApplied ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                            {isApplied ? <CopyCheck className="w-4 h-4" /> : <Layers className="w-4 h-4" />} {isApplied ? t('settingsSynced') : t('applyAll')}
                        </button>
                    </div>

                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-3 flex items-center gap-3 justify-between xl:justify-start overflow-x-auto z-10">
                         <div className="flex flex-col items-start px-2 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                <BrainCircuit className="w-4 h-4" /> {t('queue')}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {originalCount} Orig | {variantCount} Vars
                            </div>
                        </div>
                         <div className="h-8 w-px bg-slate-800 hidden md:block"></div>

                         <button onClick={clearQueue} className="p-2.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 rounded-lg border border-red-900/50 transition-all" title={t('clearQueue')}>
                             <Trash2 className="w-4 h-4" />
                         </button>

                        <button onClick={openCompositeModal} className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all shadow-lg shadow-pink-900/20">
                            <PlusSquare className="w-3.5 h-3.5"/> {t('composite')}
                        </button>

                        <button onClick={openOCRModal} disabled={isExtractingText} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all">
                            {isExtractingText ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <FileText className="w-3.5 h-3.5"/>} {t('extractText')}
                        </button>

                        <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 px-2 h-[38px]">
                            <select value={namingPattern} onChange={(e) => setNamingPattern(e.target.value as NamingPattern)} className="bg-transparent text-xs text-slate-400 outline-none h-full cursor-pointer">
                                <option value={NamingPattern.ORIGINAL}>{t('originalName')}</option>
                                <option value={NamingPattern.RANDOM_ID}>{t('randomId')}</option>
                                <option value={NamingPattern.SEQUENTIAL_PREFIX}>{t('seqPrefix')}</option>
                            </select>
                        </div>

                        <button onClick={processAll} disabled={globalProcessing} className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 uppercase tracking-wide whitespace-nowrap shadow-lg shadow-emerald-900/20 transition-all">
                            {globalProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Wand2 className="w-3.5 h-3.5"/>} {t('startQueue')}
                        </button>

                        <button onClick={downloadAllProcessed} className="bg-white hover:bg-slate-200 text-slate-950 px-4 py-2.5 rounded-lg flex items-center justify-center shadow-lg transition-all">
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </motion.div>
        )}
        </AnimatePresence>

        <AnimatePresence>
            {ocrText && (
                <motion.div initial={{ height: 0, opacity: 0, marginBottom: 0 }} animate={{ height: 'auto', opacity: 1, marginBottom: 32 }} exit={{ height: 0, opacity: 0, marginBottom: 0 }} className="overflow-hidden">
                    <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-0 shadow-2xl overflow-hidden">
                        <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
                             <h3 className="text-slate-200 font-bold text-sm uppercase tracking-widest flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-400"/> {t('ocrReport')}</h3>
                             <div className="flex gap-2">
                                 <button onClick={copyOcrToClipboard} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isTextCopied ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                                     {isTextCopied ? <Check className="w-3.5 h-3.5"/> : <Copy className="w-3.5 h-3.5"/>} {isTextCopied ? t('copied') : t('copyText')}
                                 </button>
                                 <button onClick={() => setOcrText(null)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                                     <X className="w-4 h-4" />
                                 </button>
                             </div>
                        </div>
                        <div className="p-6 bg-[#020617] relative">
                             <pre className="text-slate-300 font-mono text-sm leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[400px] custom-scrollbar">
                                 {ocrText}
                             </pre>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-6">
            <AnimatePresence>
            {images.map(img => (
                <ImageCard 
                    key={img.id} 
                    item={img} 
                    onUpdateConfig={updateConfig} 
                    onProcess={processSingleImage} 
                    onRemove={removeImage} 
                    onEdit={setEditingId}
                    onMultiVariant={handleMultiVariant} 
                />
            ))}
            </AnimatePresence>
        </div>

      </main>
    </div>
  );
};

export default App;
