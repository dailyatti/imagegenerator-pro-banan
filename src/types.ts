
export enum OutputFormat {
  JPG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
}

export enum AiResolution {
  RES_1K = '1K',
  RES_2K = '2K',
  RES_4K = '4K',
}

export enum AspectRatio {
  SQUARE = '1:1',
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
  STANDARD_LANDSCAPE = '4:3',
  STANDARD_PORTRAIT = '3:4',
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface ImageFileMeta {
  name: string;
  size: number;
  width: number;
  height: number;
  type: string;
}

export interface ImageItem {
  id: string;
  file: File;
  previewUrl: string; // The original image preview (or cropped version)
  originalMeta: ImageFileMeta;
  
  // Configuration for this specific image
  targetFormat: OutputFormat;
  targetResolution: AiResolution;
  targetAspectRatio: AspectRatio;
  
  // Optional User Overrides
  userPrompt?: string; 
  customOutputName?: string; 
  
  // Output state
  status: ProcessingStatus;
  processedUrl?: string;
  processedMeta?: ImageFileMeta;
  errorMessage?: string;

  // Duplicate handling
  duplicateIndex?: number;
}

export enum NamingPattern {
  ORIGINAL = 'ORIGINAL',
  RANDOM_ID = 'RANDOM_ID',
  SEQUENTIAL_PREFIX = 'SEQUENTIAL_PREFIX', // 01_filename
  SEQUENTIAL_SUFFIX = 'SEQUENTIAL_SUFFIX', // filename_01
}

export type LanguageCode = 'en' | 'hu' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'ru' | 'ja' | 'ko' | 'zh'; 

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
    webkitSpeechRecognition: any;
    webkitAudioContext: any;
  }
}
