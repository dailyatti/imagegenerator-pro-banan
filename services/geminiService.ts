import { GoogleGenAI, Type } from "@google/genai";
import { AiResolution, ImageItem, AspectRatio, OutputFormat } from "../types";
import { fileToBase64, convertImageFormat } from "./imageUtils";

const MODEL_NAME = 'gemini-3-pro-image-preview'; 
const TEXT_MODEL = 'gemini-2.5-flash';

export const processImageWithGemini = async (item: ImageItem): Promise<{
  processedUrl: string;
  width: number;
  height: number;
  size: number;
}> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64Data = await fileToBase64(item.file);
    
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

    if (isRemovalRequested) {
        instructions = `
        ${preservationProtocol}
        
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
        
        USER DIRECTIVE (Creative Style): "${item.userPrompt || 'High fidelity remaster'}"
        
        STRICT CONSTRAINT:
        - The output image MUST contain the original text (if any) from the source image.
        - The text must be sharp, legible, and in the same relative position (e.g., if it was at the bottom, keep it at the bottom).
        - ONLY the background should be expanded/modified to fit the new Aspect Ratio.
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

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: item.file.type, data: base64Data } },
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
    throw error;
  }
};

export const generateImageFromText = async (
  prompt: string,
  config: { format: OutputFormat; resolution: AiResolution; aspectRatio: AspectRatio }
): Promise<{ processedUrl: string; width: number; height: number; size: number }> => {
  try {
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     
     const response = await ai.models.generateContent({
       model: MODEL_NAME,
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
    throw error;
  }
};

export const processGenerativeFill = async (
  imageBlob: Blob,
  format: OutputFormat = OutputFormat.PNG
): Promise<{ processedUrl: string; width: number; height: number; size: number }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const buffer = await imageBlob.arrayBuffer();
    const base64Data = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    
    const prompt = `
      TASK: SEAMLESS TEXTURE EXTRAPOLATION (OUTPAINTING).
      
      1. VOID DETECTION: Treat white (#FFFFFF) pixels around the edge as NULL space.
      2. CONTINUATION: Extend the image texture, lighting, and noise into the void.
      3. SEAMLESS: The border between original and new must be invisible.
      4. NO DISTORTION: Do not stretch the original content.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: base64Data } },
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
    throw error;
  }
};

export const processCompositeGeneration = async (
  images: ImageItem[], 
  prompt: string, 
  config: { format: OutputFormat; resolution: AiResolution; aspectRatio: AspectRatio }
): Promise<{ processedUrl: string; width: number; height: number; size: number }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const parts: any[] = [
      { text: `
        TASK: COMPOSITE IMAGE MERGER.
        USER DIRECTIVE: "${prompt || 'Merge these images seamlessly.'}"
        
        RULES:
        1. SPATIAL TYPOGRAPHY: If user asks to move text (up/down/left/right), use pixel coordinates to place it accurately.
        2. CONTENT PRESERVATION: Keep faces and text from source images intact.
        3. OUTPAINTING: If aspect ratios differ, fill the background, do not stretch.
        
        OUTPUT:
        - Aspect Ratio: ${config.aspectRatio}
        - Resolution: ${config.resolution}
      `}
    ];

    const batch = images.slice(0, 4);
    for (const img of batch) {
      let mimeType = img.file.type;
      let b64 = await fileToBase64(img.file);
      
      if (mimeType === 'image/svg+xml') {
          try {
              const { blob } = await convertImageFormat(b64, OutputFormat.PNG, 'image/svg+xml');
              b64 = await fileToBase64(new File([blob], "converted.png", { type: "image/png" }));
              mimeType = 'image/png';
          } catch (e) { console.warn("SVG rasterize failed", e); }
      }

      parts.push({
        inlineData: { mimeType: mimeType, data: b64 }
      });
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
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
    throw error;
  }
};

export const extractTextFromImages = async (images: ImageItem[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
          } catch (e) {}
      }
      const b64 = await fileToBase64(blob);
      parts.push({ inlineData: { mimeType: img.file.type, data: b64 } });
    }

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: { parts: [{ text: `
          Act as a professional prompt engineer for AI image generation. 
          Enhance the following prompt to be more descriptive, artistic, and specific. 
          Focus on lighting, style, camera angle, and details.
          
          Original: "${originalPrompt}"
          
          Output ONLY the enhanced prompt.
        ` }] },
    });
    return response.text?.trim() || originalPrompt;
  } catch (error) {
    console.error("Prompt Enhancement Error:", error);
    return originalPrompt;
  }
};
