import { GoogleGenAI, Type } from "@google/genai";
import { AiResolution, ImageItem, AspectRatio, OutputFormat } from "../types";
import { convertImageFormat } from "./imageUtils";

const getApiKey = () => localStorage.getItem('gemini_api_key') || process.env.API_KEY || '';

let aiClient: GoogleGenAI | null = null;
const getAiClient = () => {
  const apiKey = getApiKey();
  if (!aiClient && apiKey) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

const IMAGE_MODEL_STORAGE_KEY = 'banana_model_image';
const TEXT_MODEL_STORAGE_KEY = 'banana_model_text';
const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const DEFAULT_TEXT_MODEL = 'gemini-3.1-pro-preview';
const MAX_MODEL_INPUT_DIMENSION = 2048;

const getConfiguredModelName = (storageKey: string, fallback: string): string => {
  try {
    const raw = localStorage.getItem(storageKey);
    const normalized = raw?.trim();
    return normalized ? normalized : fallback;
  } catch {
    return fallback;
  }
};

const getImageModelName = () => getConfiguredModelName(IMAGE_MODEL_STORAGE_KEY, DEFAULT_IMAGE_MODEL);
const getTextModelName = () => getConfiguredModelName(TEXT_MODEL_STORAGE_KEY, DEFAULT_TEXT_MODEL);

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });

const normalizeImageBlobForModel = (source: Blob, maxDimension = MAX_MODEL_INPUT_DIMENSION): Promise<Blob> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(source);
    const image = new Image();

    image.onload = () => {
      const width = image.width;
      const height = image.height;
      const ratio = Math.min(1, maxDimension / Math.max(width, height));
      const outWidth = Math.max(1, Math.floor(width * ratio));
      const outHeight = Math.max(1, Math.floor(height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = outWidth;
      canvas.height = outHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(source);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, outWidth, outHeight);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob || source);
      }, 'image/png', 0.92);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(source);
    };

    image.src = url;
  });

const buildInlineImagePart = async (source: Blob): Promise<{ mimeType: string; data: string }> => {
  const normalized = await normalizeImageBlobForModel(source);
  return {
    mimeType: 'image/png',
    data: await blobToBase64(normalized),
  };
};

const isNetworkLikeError = (error: any): boolean => {
  const msg = String(error?.message || error || '');
  return error instanceof TypeError || /NetworkError|Failed to fetch|Load failed|CORS|network request/i.test(msg);
};

const callGenerateContentWithRetry = async (ai: GoogleGenAI, request: any, retries = 1): Promise<any> => {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      lastError = error;
      if (!isNetworkLikeError(error) || attempt === retries) {
        throw error;
      }
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastError;
};

export const processImageWithGemini = async (item: ImageItem): Promise<{
  processedUrl: string;
  width: number;
  height: number;
  size: number;
}> => {
  try {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key not found. Please authenticate first.");
    const imageModel = getImageModelName();
    const inlineData = await buildInlineImagePart(item.file);

    // Detect if user specifically asks for removal
    const promptLower = (item.userPrompt || "").toLowerCase();
    const isRemovalRequested =
      promptLower.includes("remove text") ||
      promptLower.includes("delete text") ||
      promptLower.includes("no text") ||
      promptLower.includes("felirat nélkül") ||
      promptLower.includes("töröld");

    let instructions = "";

    const preservationProtocol = `
    PROTOCOL: IMMUTABLE TYPOGRAPHY & SPATIAL ANCHORING
    
    1. TEXT IDENTIFICATION: Scan the image for text overlays, logos, or captions.
    2. PRESERVATION RULE: Unless explicitly told to remove it, ALL TEXT MUST BE PRESERVED.
       - DO NOT CROP the text.
       - DO NOT STRETCH the text.
       - DO NOT DISTORT the font aspect ratio.
    
    3. RESIZING LOGIC (Smart Reframing):
       - When changing Aspect Ratio (e.g., 9:16 -> 16:9):
         - Treat the text as part of the "Central Subject".
         - Perform "Pillarboxing" / "Outpainting": Keep the text and subject centered.
         - Extend the BACKGROUND horizontally or vertically to fill the new frame.
         - The text should remain legible and proportional to the subject, NOT stretched across the whole new width.
    `;

    const antiOverlayRule = `
    CRITICAL OUTPUT RULES:
    - NEVER render instruction text, prompt text, watermarks, UI labels, or random typography on the image.
    - If the source image has no clearly visible readable text, the output must contain no text.
    - Do not add logos, signatures, or branding marks.
    `;

    if (isRemovalRequested) {
      instructions = `
        ${preservationProtocol}
        ${antiOverlayRule}
        
        🚨 DESTRUCTIVE OVERRIDE ACTIVE: TEXT REMOVAL REQUESTED 🚨
        User explicitly asked: "${item.userPrompt}"
        
        ACTION:
        1. Identify the text/caption area.
        2. ERASE the text pixels.
        3. INPAINT the area with context-aware background texture to make it look like the text was never there.
        `;
    } else {
      instructions = `
        ${preservationProtocol}
        ${antiOverlayRule}
        
        USER DIRECTIVE (Creative Style): "${item.userPrompt || 'High fidelity remaster'}"
        
        STRICT CONSTRAINT:
        - The output image MUST contain the original text (if any) from the source image.
        - The text must be sharp, legible, and in the same relative position (e.g., if it was at the bottom, keep it at the bottom).
        - ONLY the background should be expanded/modified to fit the new Aspect Ratio.
        - Never print this instruction or the user directive onto the image.
        `;
    }

    const prompt = `
      Act as a world-class professional photo editor and digital artist.
      
      ${instructions}
      
      Technical Requirements:
      - Output Aspect Ratio: ${item.targetAspectRatio}
      - Output Resolution: ${item.targetResolution}
      - Quality: 8k, Photorealistic, No artifacts.
    `;

    const response = await callGenerateContentWithRetry(ai, {
      model: imageModel,
      contents: {
        parts: [
          { text: prompt },
          { inlineData },
        ],
      },
      config: {
        imageConfig: {
          imageSize: item.targetResolution as any,
          aspectRatio: item.targetAspectRatio as any,
        },
      },
    });

    let rawBase64: string | null = null;
    let failureReason = "";

    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          rawBase64 = part.inlineData.data;
          break;
        } else if (part.text) {
          failureReason += part.text;
        }
      }
    }

    if (!rawBase64) throw new Error(failureReason || "No image data returned from AI.");

    const converted = await convertImageFormat(rawBase64, item.targetFormat);
    return {
      processedUrl: converted.url,
      width: converted.width,
      height: converted.height,
      size: converted.blob.size,
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    if (isNetworkLikeError(error)) {
      throw new Error("Network/API connection error (CORS or blocked request). Check API key, browser privacy/adblock, and internet.");
    }
    throw error;
  }
};

export const generateImageFromText = async (
  prompt: string,
  config: { format: OutputFormat; resolution: AiResolution; aspectRatio: AspectRatio }
): Promise<{ processedUrl: string; width: number; height: number; size: number }> => {
  try {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key not found. Please authenticate first.");
    const imageModel = getImageModelName();

    const response = await callGenerateContentWithRetry(ai, {
      model: imageModel,
      contents: { parts: [{ text: `Generate a high-quality image: ${prompt}` }] },
      config: {
        imageConfig: {
          imageSize: config.resolution as any,
          aspectRatio: config.aspectRatio as any,
        },
      },
    });

    let rawBase64: string | null = null;
    let failureReason = "";

    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          rawBase64 = part.inlineData.data;
          break;
        } else if (part.text) {
          failureReason += part.text;
        }
      }
    }

    if (!rawBase64) throw new Error(failureReason || "No image data returned from AI.");

    const converted = await convertImageFormat(rawBase64, config.format);
    return {
      processedUrl: converted.url,
      width: converted.width,
      height: converted.height,
      size: converted.blob.size,
    };

  } catch (error) {
    console.error("Text to Image Error:", error);
    if (isNetworkLikeError(error)) {
      throw new Error("Network/API connection error (CORS or blocked request). Check API key, browser privacy/adblock, and internet.");
    }
    throw error;
  }
};

export const processGenerativeFill = async (
  imageBlob: Blob,
  format: OutputFormat = OutputFormat.PNG
): Promise<{ processedUrl: string; width: number; height: number; size: number }> => {
  try {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key not found. Please authenticate first.");
    const imageModel = getImageModelName();
    const inlineData = await buildInlineImagePart(imageBlob);

    const prompt = `
      TASK: SEAMLESS TEXTURE EXTRAPOLATION (OUTPAINTING).
      
      1. VOID DETECTION: Treat white (#FFFFFF) pixels around the edge as NULL space.
      2. CONTINUATION: Extend the image texture, lighting, and noise into the void.
      3. SEAMLESS: The border between original and new must be invisible.
      4. NO DISTORTION: Do not stretch the original content.
    `;

    const response = await callGenerateContentWithRetry(ai, {
      model: imageModel,
      contents: {
        parts: [
          { text: prompt },
          { inlineData },
        ],
      },
      config: {
        imageConfig: {
          imageSize: '2K',
        },
      },
    });

    let rawBase64: string | null = null;
    let failureReason = "";

    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          rawBase64 = part.inlineData.data;
          break;
        } else if (part.text) {
          failureReason += part.text;
        }
      }
    }

    if (!rawBase64) throw new Error(failureReason || "No image data returned from AI.");

    const converted = await convertImageFormat(rawBase64, format);
    return {
      processedUrl: converted.url,
      width: converted.width,
      height: converted.height,
      size: converted.blob.size,
    };

  } catch (error) {
    console.error("Generative Fill Error:", error);
    if (isNetworkLikeError(error)) {
      throw new Error("Network/API connection error (CORS or blocked request). Check API key, browser privacy/adblock, and internet.");
    }
    throw error;
  }
};

export const processCompositeGeneration = async (
  images: ImageItem[],
  prompt: string,
  config: { format: OutputFormat; resolution: AiResolution; aspectRatio: AspectRatio }
): Promise<{ processedUrl: string; width: number; height: number; size: number }> => {
  try {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key not found. Please authenticate first.");
    const imageModel = getImageModelName();

    const parts: any[] = [
      {
        text: `
        TASK: COMPOSITE IMAGE MERGER.
        USER DIRECTIVE: "${prompt || 'Merge these images seamlessly.'}"
        
        RULES:
        1. SPATIAL TYPOGRAPHY: If user asks to move text (up/down/left/right), use pixel coordinates to place it accurately.
        2. CONTENT PRESERVATION: Keep faces and text from source images intact.
        3. OUTPAINTING: If aspect ratios differ, fill the background, do not stretch.
        4. NEVER print instruction text, UI labels, prompt text, or new watermark text on the output image.
        
        OUTPUT:
        - Aspect Ratio: ${config.aspectRatio}
        - Resolution: ${config.resolution}
      `}
    ];

    const batch = images.slice(0, 4);
    for (const img of batch) {
      const inlineData = await buildInlineImagePart(img.file);
      parts.push({ inlineData });
    }

    const response = await callGenerateContentWithRetry(ai, {
      model: imageModel,
      contents: { parts },
      config: {
        imageConfig: {
          imageSize: config.resolution as any,
          aspectRatio: config.aspectRatio as any,
        },
      },
    });

    let rawBase64: string | null = null;
    let failureReason = "";

    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          rawBase64 = part.inlineData.data;
          break;
        } else if (part.text) {
          failureReason += part.text;
        }
      }
    }

    if (!rawBase64) throw new Error(failureReason || "No composite data returned.");

    const converted = await convertImageFormat(rawBase64, config.format);
    return {
      processedUrl: converted.url,
      width: converted.width,
      height: converted.height,
      size: converted.blob.size,
    };

  } catch (error) {
    console.error("Composite Error:", error);
    if (isNetworkLikeError(error)) {
      throw new Error("Network/API connection error (CORS or blocked request). Check API key, browser privacy/adblock, and internet.");
    }
    throw error;
  }
};

export const extractTextFromImages = async (images: ImageItem[]): Promise<string> => {
  try {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key not found. Please authenticate first.");
    const textModel = getTextModelName();
    const batch = images.slice(0, 5);
    const parts: any[] = [{
      text: `
      TASK: PROFESSIONAL OCR.
      - Extract ALL visible text.
      - Detect curved, stylized, and background text.
      - Output: PURE PLAIN TEXT ONLY. No markdown, no bold, no separators.
      `
    }];

    for (const img of batch) {
      let blob = img.file;
      if (img.processedUrl) {
        try {
          const r = await fetch(img.processedUrl);
          blob = await r.blob() as File;
        } catch (e) { }
      }
      const inlineData = await buildInlineImagePart(blob);
      parts.push({ inlineData });
    }

    const response = await callGenerateContentWithRetry(ai, {
      model: textModel,
      contents: { parts },
    });

    return response.text || "No text found.";
  } catch (error) {
    console.error("OCR Error", error);
    return "OCR Failed.";
  }
};

export const enhancePrompt = async (originalPrompt: string): Promise<string> => {
  try {
    const ai = getAiClient();
    if (!ai) return originalPrompt;
    const textModel = getTextModelName();
    const response = await callGenerateContentWithRetry(ai, {
      model: textModel,
      contents: {
        parts: [{
          text: `
          Act as a professional prompt engineer for AI image generation. 
          Enhance the following prompt to be more descriptive, artistic, and specific. 
          Focus on lighting, style, camera angle, and details.
          
          Original: "${originalPrompt}"
          
          Output ONLY the enhanced prompt.
        ` }]
      },
    });
    return response.text?.trim() || originalPrompt;
  } catch (error) {
    console.error("Prompt Enhancement Error:", error);
    return originalPrompt;
  }
};
