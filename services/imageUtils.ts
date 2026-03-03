
import { OutputFormat } from '../types';

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(objectUrl);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for dimension extraction'));
    };
    
    img.src = objectUrl;
  });
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix for Gemini API
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Converts a base64 image string to the target format (WebP/JPG/PNG).
 * Supports specifying the source mime type (defaulting to image/png if not provided, strictly for legacy compatibility, 
 * though providing it is recommended for SVGs).
 */
export const convertImageFormat = (
  base64Data: string, 
  format: OutputFormat,
  sourceMimeType: string = 'image/png'
): Promise<{ blob: Blob; url: string; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Enable CORS for any external usage, though base64 is local
    img.crossOrigin = "Anonymous"; 
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      // Draw image
      ctx.drawImage(img, 0, 0);
      
      // Convert to blob
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Conversion failed'));
          return;
        }
        const url = URL.createObjectURL(blob);
        resolve({ blob, url, width: img.width, height: img.height });
      }, format, 0.9); // 0.9 quality
    };
    
    img.onerror = (err) => {
        console.error("Image load error in conversion", err);
        reject(new Error("Failed to load image for conversion"));
    };
    
    // Use the correct source MIME type prefix
    img.src = `data:${sourceMimeType};base64,${base64Data}`;
  });
};
