/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Copy, 
  Check, 
  Shield, 
  Zap, 
  Terminal, 
  Layout, 
  BarChart3, 
  Users,
  ExternalLink,
  Loader2,
  X,
  FileText,
  Minimize2,
  RefreshCw,
  Maximize2,
  Crop as CropIcon,
  Type,
  RotateCw,
  Download,
  Settings,
  Layers,
  QrCode,
  Sparkles,
  Twitter,
  Instagram,
  Brain,
  Cpu,
  Bot,
  Wand2,
  Stars,
  Lightbulb
} from 'lucide-react';

import confetti from 'canvas-confetti';
import * as QRCode from 'qrcode';
import { GoogleGenAI } from "@google/genai";

interface UploadResponse {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export type ToolId = 'pdf' | 'compress' | 'convert' | 'webp' | 'resize' | 'prompt' | 'watermark' | 'qr' | 'host';

interface Tool {
  id: ToolId;
  name: string;
  description: string;
  icon: any;
  color: string;
}

const TOOLS: Tool[] = [
  { id: 'host', name: 'Image to URL', description: 'Upload image and get a shareable link', icon: ExternalLink, color: 'bg-blue-500' },
  { id: 'pdf', name: 'Image to PDF', description: 'Convert images to a single PDF', icon: FileText, color: 'bg-red-500' },
  { id: 'compress', name: 'Compressor', description: 'Reduce file size while keeping the same format', icon: Minimize2, color: 'bg-green-500' },
  { id: 'convert', name: 'Format Converter', description: 'JPG to PNG and vice versa', icon: RefreshCw, color: 'bg-orange-500' },
  { id: 'webp', name: 'WebP Converter', description: 'Convert to modern WebP format', icon: Zap, color: 'bg-yellow-500' },
  { id: 'resize', name: 'Resize Tool', description: 'Change image dimensions', icon: Maximize2, color: 'bg-indigo-500' },
  { id: 'prompt', name: 'Image to Prompt', description: 'Generate AI prompt from image', icon: Sparkles, color: 'bg-pink-500' },
  { id: 'watermark', name: 'Watermark', description: 'Add text watermark to images', icon: Type, color: 'bg-teal-500' },
  { id: 'qr', name: 'QR Generator', description: 'Text or Image to QR Code', icon: QrCode, color: 'bg-rose-500' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'features' | 'tools' | 'pricing'>('home');
  const [previousTab, setPreviousTab] = useState<'home' | 'features' | 'tools' | 'pricing'>('home');
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);
  const [plan, setPlan] = useState<'free' | 'pro' | 'enterprise'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('userPlan') as any) || 'free';
    }
    return 'free';
  });

  const [usageData, setUsageData] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('usageData');
      if (saved) {
        const parsed = JSON.parse(saved);
        const today = new Date().toDateString();
        if (parsed.date === today) {
          return parsed;
        }
      }
    }
    return { count: 0, date: new Date().toDateString() };
  });

  useEffect(() => {
    localStorage.setItem('userPlan', plan);
  }, [plan]);

  useEffect(() => {
    localStorage.setItem('usageData', JSON.stringify(usageData));
  }, [usageData]);

  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFixConnection, setShowFixConnection] = useState(false);
  const [toolSettings, setToolSettings] = useState({
    quality: 80,
    format: 'png',
    width: 800,
    height: 600,
    left: 0,
    top: 0,
    cropWidth: 400,
    cropHeight: 400,
    watermarkText: 'Tooldack',
    watermarkOpacity: 0.5,
    qrText: '',
    qrColor: '#000000',
    qrBg: '#ffffff',
    qrErrorLevel: 'M' as 'L' | 'M' | 'Q' | 'H',
    qrLogoUrl: ''
  });
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return; // Ignore messages from other origins
      }
      if (event.data?.type === 'AUTH_SUCCESS') {
        setShowFixConnection(false);
        setError(null);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const copyToClipboard = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const handleFixConnection = () => {
    const authWindow = window.open('/api/auth-check', 'auth_popup', 'width=500,height=600');
    if (authWindow) {
      authWindow.postMessage({ type: 'PARENT_INIT' }, window.location.origin);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (selectedTool === 'pdf') {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => (f as File).type.startsWith('image/'));
      if (droppedFiles.length > 0) {
        setMultipleFiles(prev => [...prev, ...droppedFiles]);
        setError(null);
      } else {
        setError('Please drop valid image files.');
      }
      return;
    }

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Please drop a valid image file.');
    }
  }, [selectedTool]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedTool === 'pdf') {
      const selectedFiles = Array.from(e.target.files || []).filter(f => (f as File).type.startsWith('image/'));
      if (selectedFiles.length > 0) {
        setMultipleFiles(prev => [...prev, ...selectedFiles]);
        setError(null);
      }
      return;
    }

    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleProcessTool = async () => {
    if (!file && multipleFiles.length === 0 && selectedTool !== 'qr') return;
    setUploading(true);
    setError(null);

    if (plan === 'free' && usageData.count >= 5) {
      setError('Daily limit reached for Free plan (5 uses/day). Please upgrade to Pro for unlimited access.');
      setActiveTab('pricing');
      setUploading(false);
      return;
    }

    if (selectedTool === 'prompt') {
      if (!file) {
        setError('Please upload an image first');
        setUploading(false);
        return;
      }
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const base64Data = await fileToBase64(file);
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              {
                text: "Describe this image in detail as a high-quality AI image generation prompt. Focus on style, lighting, composition, and specific visual elements. Provide only the prompt text.",
              },
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64Data,
                },
              },
            ],
          },
        });

        setGeneratedPrompt(response.text || 'No prompt generated');
        
        if (plan === 'free') {
          setUsageData(prev => ({ ...prev, count: prev.count + 1 }));
        }

        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err: any) {
        console.error("Gemini Error:", err);
        setError("Failed to generate prompt: " + err.message);
      } finally {
        setUploading(false);
      }
      return;
    }

    if (selectedTool === 'qr') {
      try {
        let textToEncode = toolSettings.qrText.trim();
        
        if (!textToEncode) {
          throw new Error('Please enter some text or upload an image to generate a QR code');
        }

        // Use a hidden canvas for drawing
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        
        // Generate QR on canvas
        await QRCode.toCanvas(canvas, textToEncode, {
          errorCorrectionLevel: toolSettings.qrErrorLevel,
          color: {
            dark: toolSettings.qrColor,
            light: toolSettings.qrBg
          },
          width: 1024,
          margin: 2
        });

        // If a logo is provided, draw it in the center
        if (toolSettings.qrLogoUrl) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            try {
              const logo = new Image();
              logo.crossOrigin = "anonymous";
              logo.src = toolSettings.qrLogoUrl;
              
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Logo load timeout')), 5000);
                logo.onload = () => {
                  clearTimeout(timeout);
                  resolve(null);
                };
                logo.onerror = () => {
                  clearTimeout(timeout);
                  reject(new Error('Failed to load logo image'));
                };
              });

              const logoSize = canvas.width * 0.22;
              const x = (canvas.width - logoSize) / 2;
              const y = (canvas.height - logoSize) / 2;

              // Draw a background for the logo
              ctx.fillStyle = toolSettings.qrBg;
              ctx.fillRect(x - 10, y - 10, logoSize + 20, logoSize + 20);
              
              ctx.drawImage(logo, x, y, logoSize, logoSize);
            } catch (logoErr: any) {
              console.warn("Logo failed to load:", logoErr);
              setError("Warning: Logo could not be loaded. QR generated without logo.");
            }
          }
        }

        const qrDataUrl = canvas.toDataURL('image/png');
        
        // Helper to convert dataURL to Blob
        const dataURLtoBlob = (dataurl: string) => {
          const arr = dataurl.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1];
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          return new Blob([u8arr], { type: mime });
        };

        const blob = dataURLtoBlob(qrDataUrl);
        setProcessedBlob(blob);
        setProcessedUrl(qrDataUrl);
        
        if (plan === 'free') {
          setUsageData(prev => ({ ...prev, count: prev.count + 1 }));
        }

        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err: any) {
        setError(err.message || 'Failed to generate QR code');
      } finally {
        setUploading(false);
      }
      return;
    }

    const formData = new FormData();
    let endpoint = '';

    switch (selectedTool) {
      case 'pdf':
        multipleFiles.forEach(f => formData.append('images', f));
        endpoint = '/api/image-to-pdf';
        break;
      case 'compress':
        formData.append('image', file!);
        formData.append('quality', toolSettings.quality.toString());
        endpoint = '/api/compress';
        break;
      case 'convert':
        formData.append('image', file!);
        formData.append('format', toolSettings.format);
        endpoint = '/api/convert-format';
        break;
      case 'webp':
        formData.append('image', file!);
        formData.append('quality', toolSettings.quality.toString());
        endpoint = '/api/webp-convert';
        break;
      case 'resize':
        formData.append('image', file!);
        formData.append('width', toolSettings.width.toString());
        formData.append('height', toolSettings.height.toString());
        endpoint = '/api/resize';
        break;
      case 'prompt':
        // Handled directly above
        return;
      case 'watermark':
        formData.append('image', file!);
        formData.append('text', toolSettings.watermarkText);
        formData.append('opacity', toolSettings.watermarkOpacity.toString());
        endpoint = '/api/watermark';
        break;
      case 'host':
        formData.append('image', file!);
        endpoint = '/api/upload';
        break;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Processing failed');
        } else {
          const text = await response.text();
          if (text.includes('Cookie check') || text.includes('Authenticate in new window') || response.status === 401) {
            setShowFixConnection(true);
            throw new Error('Connection verification required. Please click the "Verify Connection" button below.');
          }
          console.error('Non-JSON error response:', text);
          throw new Error(`Server error (${response.status}). Please try again.`);
        }
      }

      if (selectedTool === 'host') {
        const data = await response.json();
        setResult(data);
        setProcessedUrl(data.url);
      } else {
        const blob = await response.blob();
        setProcessedBlob(blob);
        const url = URL.createObjectURL(blob);
        setProcessedUrl(url);
      }
      
      if (plan === 'free') {
        setUsageData(prev => ({ ...prev, count: prev.count + 1 }));
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (err: any) {
      setError(err.message || 'Failed to process image.');
    } finally {
      setUploading(false);
    }
  };

  const downloadProcessed = () => {
    if (!processedUrl) return;
    const a = document.createElement('a');
    a.href = processedUrl;
    a.download = selectedTool === 'pdf' ? 'converted.pdf' : selectedTool === 'qr' ? 'qrcode.png' : `processed-${Date.now()}.${toolSettings.format === 'png' ? 'png' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setMultipleFiles([]);
    setProcessedBlob(null);
    setProcessedUrl(null);
    setGeneratedPrompt(null);
  };

  const selectTool = (id: ToolId) => {
    setPreviousTab(activeTab);
    reset();
    setSelectedTool(id);
  };

  const ToolView = ({ toolId }: { toolId: ToolId }) => {
    const tool = TOOLS.find(t => t.id === toolId);
    if (!tool) return null;

    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => { 
              setSelectedTool(null); 
              reset(); 
              setActiveTab(previousTab);
            }}
            className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className={`w-12 h-12 ${tool.color} rounded-xl flex items-center justify-center text-white`}>
            <tool.icon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{tool.name}</h2>
            <p className="text-slate-500 text-sm">{tool.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Upload & Preview */}
          <div className="space-y-6">
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`bg-white dark:bg-zinc-950 rounded-xl border-2 border-dashed transition-all p-8 min-h-[300px] flex flex-col items-center justify-center ${isDragging ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'border-slate-300 dark:border-zinc-800'}`}
            >
              {!file && multipleFiles.length === 0 && !processedUrl && (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mb-4">
                    {toolId === 'qr' ? <QrCode className="w-8 h-8 text-blue-600" /> : <Upload className="w-8 h-8 text-blue-600" />}
                  </div>
                  <p className="text-sm font-medium mb-4 text-center">
                    {toolId === 'pdf' ? 'Drag & drop images' : toolId === 'qr' ? 'Upload an image to link or use text' : 'Drag & drop an image'}
                  </p>
                  <label className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold cursor-pointer hover:bg-blue-700 transition-all">
                    Browse
                    <input type="file" className="hidden" accept="image/*" multiple={toolId === 'pdf'} onChange={handleFileChange} />
                  </label>
                </div>
              )}

              {file && !processedUrl && (
                <div className="w-full flex flex-col items-center">
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 mb-4">
                    <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-contain" />
                    <button onClick={reset} className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-xs font-bold truncate max-w-full">{file.name}</p>
                </div>
              )}

              {multipleFiles.length > 0 && !processedUrl && (
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold">{multipleFiles.length} files selected</p>
                    <button onClick={reset} className="text-xs text-red-500 font-bold">Clear All</button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {multipleFiles.map((f, i) => (
                      <div key={i} className="aspect-square rounded bg-slate-100 dark:bg-zinc-900 overflow-hidden border border-slate-200 dark:border-zinc-800">
                        <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {generatedPrompt && (
                <div className="w-full flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-bold mb-6">Prompt Generated!</h3>
                  
                  <div className="w-full bg-slate-50 dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 mb-6 relative group">
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 italic">
                      "{generatedPrompt}"
                    </p>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(generatedPrompt); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="absolute top-4 right-4 p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-sm hover:shadow-md transition-all text-blue-600"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={reset} className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all">
                      Try Another
                    </button>
                  </div>
                </div>
              )}



              {processedUrl && (
                <div className="w-full flex flex-col items-center">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                    <Check className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-lg font-bold mb-6">{toolId === 'host' ? 'Upload Complete!' : 'Processing Complete!'}</h3>
                  
                  {toolId === 'host' && result && (
                    <div className="w-full space-y-4 mb-6">
                      <div className="bg-slate-50 dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 relative group">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Direct Link</p>
                        <p className="text-sm truncate pr-10 font-mono text-blue-600">{result.url}</p>
                        <button 
                          onClick={() => { navigator.clipboard.writeText(result.url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                          className="absolute top-1/2 -translate-y-1/2 right-4 p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-sm hover:shadow-md transition-all text-blue-600"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 relative group">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Markdown</p>
                        <p className="text-sm truncate pr-10 font-mono text-slate-600">![Image]({result.url})</p>
                        <button 
                          onClick={() => { navigator.clipboard.writeText(`![Image](${result.url})`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                          className="absolute top-1/2 -translate-y-1/2 right-4 p-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-sm hover:shadow-md transition-all text-blue-600"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {processedBlob && file && (toolId === 'compress' || toolId === 'webp') && (
                    <div className="w-full grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 dark:bg-zinc-900 p-4 rounded-lg border border-slate-200 dark:border-zinc-800 text-center">
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Original</p>
                        <p className="font-bold text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 text-center">
                        <p className="text-[10px] text-blue-400 uppercase font-bold mb-1">{toolId === 'compress' ? 'Compressed' : 'WebP Result'}</p>
                        <p className="font-bold text-sm text-blue-600">{(processedBlob.size / 1024).toFixed(1)} KB</p>
                        <p className="text-[10px] text-green-600 font-bold mt-1">
                          {processedBlob.size < file.size ? `-${Math.round((1 - processedBlob.size / file.size) * 100)}% Saved` : 'Optimized'}
                        </p>
                      </div>
                    </div>
                  )}

                  {toolId !== 'pdf' && (
                    <div className={`w-full aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 mb-6`}>
                      <img src={processedUrl} className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="flex gap-4">
                    <button onClick={downloadProcessed} className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700">
                      <Download className="w-4 h-4" /> Download
                    </button>
                    <button onClick={reset} className="text-slate-500 font-bold hover:text-slate-700">Reset</button>
                  </div>
                </div>
              )}
          </div>
        </div>

          {/* Right: Controls */}
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-8">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold">Tool Settings</h3>
            </div>

            <div className="space-y-6">
              {toolId === 'compress' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Quality ({toolSettings.quality}%)</label>
                    <input 
                      type="range" min="10" max="100" step="1" 
                      value={toolSettings.quality} 
                      onChange={(e) => setToolSettings({...toolSettings, quality: parseInt(e.target.value)})}
                      className="w-full accent-blue-600"
                    />
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-[10px] text-green-600 dark:text-green-400 leading-relaxed font-medium">
                      Smart compression: Keeps PNGs as PNG (with palette optimization) and JPEGs as JPEG. Recommended: 70-80% for best balance.
                    </p>
                  </div>
                </div>
              )}

              {toolId === 'webp' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">WebP Quality ({toolSettings.quality}%)</label>
                    <input 
                      type="range" min="10" max="100" step="1" 
                      value={toolSettings.quality} 
                      onChange={(e) => setToolSettings({...toolSettings, quality: parseInt(e.target.value)})}
                      className="w-full accent-blue-600"
                    />
                  </div>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-[10px] text-yellow-700 dark:text-yellow-400 leading-relaxed font-medium">
                      WebP offers superior lossless and lossy compression for images on the web. It is 26% smaller than PNG and 25-34% smaller than JPEG.
                    </p>
                  </div>
                </div>
              )}

              {toolId === 'convert' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Target Format</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['png', 'jpeg'].map(f => (
                      <button 
                        key={f}
                        onClick={() => setToolSettings({...toolSettings, format: f})}
                        className={`py-2 rounded-lg border font-bold transition-all ${toolSettings.format === f ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'border-slate-200 dark:border-zinc-800'}`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {toolId === 'resize' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Width (px)</label>
                    <input 
                      type="number" 
                      value={toolSettings.width} 
                      onChange={(e) => setToolSettings({...toolSettings, width: parseInt(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Height (px)</label>
                    <input 
                      type="number" 
                      value={toolSettings.height} 
                      onChange={(e) => setToolSettings({...toolSettings, height: parseInt(e.target.value)})}
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-4 py-2"
                    />
                  </div>
                </div>
              )}

              {toolId === 'prompt' && (
                <div className="p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
                  <p className="text-xs text-pink-600 dark:text-pink-400 leading-relaxed font-medium">
                    Upload an image to generate a detailed text prompt. You can use this prompt in other AI tools like Midjourney, DALL-E, or Stable Diffusion to recreate similar images.
                  </p>
                </div>
              )}



              {toolId === 'watermark' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Watermark Text</label>
                    <input 
                      type="text" 
                      value={toolSettings.watermarkText} 
                      onChange={(e) => setToolSettings({...toolSettings, watermarkText: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Opacity ({Math.round(toolSettings.watermarkOpacity * 100)}%)</label>
                    <input 
                      type="range" min="0" max="1" step="0.1" 
                      value={toolSettings.watermarkOpacity} 
                      onChange={(e) => setToolSettings({...toolSettings, watermarkOpacity: parseFloat(e.target.value)})}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>
              )}

              {toolId === 'host' && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed font-medium">
                    Upload your image to our high-speed servers and get a permanent link. Perfect for sharing on social media, forums, or blogs.
                  </p>
                </div>
              )}



              {toolId === 'pdf' && (
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Upload multiple images to merge them into a single PDF document. Images will be added in the order they are uploaded.
                  </p>
                </div>
              )}

              {toolId === 'qr' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase">QR Content (Text or URL)</label>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setToolSettings({...toolSettings, qrText: 'https://google.com'})}
                          className="text-[10px] text-blue-600 font-bold hover:underline"
                        >
                          Sample URL
                        </button>
                        <button 
                          onClick={() => setToolSettings({...toolSettings, qrText: ''})}
                          className="text-[10px] text-red-500 font-bold hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <textarea 
                      value={toolSettings.qrText} 
                      onChange={(e) => setToolSettings({...toolSettings, qrText: e.target.value})}
                      placeholder="Enter text or URL to encode..."
                      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm min-h-[100px]"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Note: If you upload an image, the QR code will link to that image URL instead.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">QR Color</label>
                      <input 
                        type="color" 
                        value={toolSettings.qrColor} 
                        onChange={(e) => setToolSettings({...toolSettings, qrColor: e.target.value})}
                        className="w-full h-10 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Background</label>
                      <input 
                        type="color" 
                        value={toolSettings.qrBg} 
                        onChange={(e) => setToolSettings({...toolSettings, qrBg: e.target.value})}
                        className="w-full h-10 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Error Correction</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['L', 'M', 'Q', 'H'].map(level => (
                        <button 
                          key={level}
                          onClick={() => setToolSettings({...toolSettings, qrErrorLevel: level as any})}
                          className={`py-2 rounded-lg border text-xs font-bold transition-all ${toolSettings.qrErrorLevel === level ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'border-slate-200 dark:border-zinc-800'}`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Higher levels allow for more damage/logo coverage but make the QR denser.</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase">Center Logo (Optional URL)</label>
                      <button 
                        onClick={() => setToolSettings({...toolSettings, qrLogoUrl: 'https://cdn-icons-png.flaticon.com/512/25/25231.png', qrErrorLevel: 'H'})}
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                      >
                        Use Sample Logo
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={toolSettings.qrLogoUrl} 
                        onChange={(e) => setToolSettings({...toolSettings, qrLogoUrl: e.target.value})}
                        placeholder="https://example.com/logo.png"
                        className="flex-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm"
                      />
                      {toolSettings.qrLogoUrl && (
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded border border-slate-200 dark:border-zinc-800 overflow-hidden bg-white">
                            <img src={toolSettings.qrLogoUrl} alt="Logo Preview" className="w-full h-full object-contain" onError={(e) => (e.currentTarget.src = 'https://placehold.co/40x40?text=!')} />
                          </div>
                          <button 
                            onClick={() => setToolSettings({...toolSettings, qrLogoUrl: ''})}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button 
                onClick={handleProcessTool}
                disabled={uploading || (!file && multipleFiles.length === 0 && (toolId !== 'qr' || !toolSettings.qrText))}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-8 shadow-lg shadow-blue-600/20"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Process Now
                  </>
                )}
              </button>

              {error && <p className="text-red-500 text-xs font-bold text-center mt-4">{error}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        {showFixConnection && (
          <div className="bg-blue-600 text-white py-2 px-6 text-center text-xs font-bold flex items-center justify-center gap-4">
            <span>Action Required: Please verify your connection to enable all features.</span>
            <button 
              onClick={handleFixConnection}
              className="bg-white text-blue-600 px-3 py-1 rounded font-black hover:bg-blue-50 transition-colors"
            >
              Verify Connection
            </button>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="https://res.cloudinary.com/dqywq17cr/image/upload/v1772113455/tooldack_uploads/lhmln6criszu16t19rqb.jpg" 
              alt="Tooldack Logo" 
              className="h-14 w-auto object-contain" 
              referrerPolicy="no-referrer"
            />
            <span className="hidden sm:block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2 border-l border-slate-200 dark:border-slate-800 pl-3">
              Made By Abhishya
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => {
                setActiveTab('home');
                reset();
                setSelectedTool(null);
              }}
              className={`text-sm font-medium transition-colors ${activeTab === 'home' ? 'text-blue-600' : 'text-slate-600 dark:text-white hover:text-blue-600'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setActiveTab('features')}
              className={`text-sm font-medium transition-colors ${activeTab === 'features' ? 'text-blue-600' : 'text-slate-600 dark:text-white hover:text-blue-600'}`}
            >
              Features
            </button>
            <button 
              onClick={() => {
                setActiveTab('tools');
                setSelectedTool(null);
                reset();
              }}
              className={`text-sm font-medium transition-colors ${activeTab === 'tools' ? 'text-blue-600' : 'text-slate-600 dark:text-white hover:text-blue-600'}`}
            >
              Tools
            </button>
            <button 
              onClick={() => setActiveTab('pricing')}
              className={`text-sm font-medium transition-colors ${activeTab === 'pricing' ? 'text-blue-600' : 'text-slate-600 dark:text-white hover:text-blue-600'}`}
            >
              Pricing
            </button>
          </div>

          <div className="flex items-center gap-4">
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20">
        <AnimatePresence mode="wait">
          {activeTab === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Hero Section */}
              <div className="max-w-7xl mx-auto px-6 text-center">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-2 bg-blue-600/10 text-blue-600 px-3 py-1 rounded-full text-xs font-bold mb-6"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-600 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                  </span>
                  NEW: API V2 IS NOW LIVE
                </motion.div>

                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-6 max-w-4xl mx-auto leading-[1.1]"
                >
                  Professional <span className="text-blue-600">Image</span> Processing Suite
                </motion.h1>

                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-lg text-slate-600 dark:text-white max-w-2xl mx-auto mb-12"
                >
                  A comprehensive collection of high-performance image tools. Convert, compress, resize, and optimize your visuals with ease.
                </motion.p>

                {/* Quick Tools Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 max-w-7xl mx-auto mb-20">
                  {TOOLS.map(tool => (
                    <button 
                      key={tool.id}
                      onClick={() => {
                        setActiveTab('tools');
                        selectTool(tool.id);
                      }}
                      className="bg-white dark:bg-zinc-950 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-blue-600 hover:shadow-xl transition-all group text-center"
                    >
                      <div className={`w-12 h-12 ${tool.color} rounded-xl flex items-center justify-center text-white mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                        <tool.icon className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-sm">{tool.name}</h3>
                    </button>
                  ))}
                </div>
              </div>

                {/* What's New / AI Tools Highlight */}
                <div className="max-w-7xl mx-auto px-6 mb-20">
                  <div className="bg-gradient-to-r from-violet-600/10 to-pink-600/10 rounded-3xl p-8 md:p-12 border border-violet-200 dark:border-violet-900/50 relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="text-left max-w-xl">
                        <div className="inline-flex items-center gap-2 bg-violet-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4">
                          <Sparkles className="w-3 h-3" /> New AI Features
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Unleash the Power of AI</h2>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">
                          Experience our new AI-powered tools. Generate detailed prompts from images or create stunning visuals from simple text descriptions.
                        </p>
                        <div className="flex flex-wrap gap-4">
                          <button 
                            onClick={() => { setActiveTab('tools'); selectTool('prompt'); }}
                            className="bg-pink-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-pink-700 transition-all flex items-center gap-2"
                          >
                            Image to Prompt
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="w-48 h-48 md:w-64 md:h-64 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 rotate-3 flex items-center justify-center p-4">
                           <div className="w-full h-full bg-slate-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center overflow-hidden">
                              <img 
                                src="https://picsum.photos/seed/ai-art/400/400" 
                                alt="AI Art" 
                                className="w-full h-full object-cover opacity-80"
                                referrerPolicy="no-referrer"
                              />
                           </div>
                        </div>
                        <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 -rotate-6 flex items-center justify-center p-2 hidden md:flex">
                           <div className="w-full h-full bg-slate-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center overflow-hidden">
                              <img 
                                src="https://picsum.photos/seed/ai-prompt/400/400" 
                                alt="AI Prompt" 
                                className="w-full h-full object-cover opacity-80"
                                referrerPolicy="no-referrer"
                              />
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social Proof */}
                <div className="space-y-6">
                  <p className="text-xs font-bold text-slate-400 dark:text-white/60 tracking-widest uppercase">Trusted by developers at</p>
                  <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 dark:opacity-80 grayscale hover:grayscale-0 transition-all duration-500">
                    <div className="flex items-center gap-2 font-black text-xl">
                      <Zap className="w-6 h-6 text-blue-600" /> DEVFLOW
                    </div>
                    <div className="flex items-center gap-2 font-black text-xl">
                      <Layout className="w-6 h-6 text-blue-600" /> STACKHOST
                    </div>
                    <div className="flex items-center gap-2 font-black text-xl">
                      <Terminal className="w-6 h-6 text-blue-600" /> PIXELCORE
                    </div>
                    <div className="flex items-center gap-2 font-black text-xl">
                      <Shield className="w-6 h-6 text-blue-600" /> FASTLY
                    </div>
                  </div>
                </div>

              {/* How It Works */}
              <section className="py-24 bg-white dark:bg-black mt-20 border-y border-slate-200 dark:border-zinc-900">
                <div className="max-w-7xl mx-auto px-6">
                  <div className="mb-16">
                    <h2 className="text-3xl font-bold mb-4">How It Works</h2>
                    <p className="text-slate-600 dark:text-slate-300">Three simple steps to process your images.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                      { step: '1', title: 'Choose Tool', icon: Layout, desc: 'Select from our wide range of image processing tools like PDF converter, compressor, or resizer.' },
                      { step: '2', title: 'Upload', icon: Upload, desc: 'Drag and drop your image files. Our secure processing engine handles everything locally or via high-speed APIs.' },
                      { step: '3', title: 'Download', icon: Download, desc: 'Get your processed files instantly. High quality results, optimized for your needs.' }
                    ].map((item, i) => (
                      <motion.div 
                        key={i}
                        whileHover={{ y: -5 }}
                        className="bg-white dark:bg-zinc-950 p-8 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all"
                      >
                        <div className="w-12 h-12 bg-blue-600/10 rounded-lg flex items-center justify-center mb-6">
                          <item.icon className="w-6 h-6 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-3">{item.step}. {item.title}</h3>
                        <p className="text-slate-600 dark:text-white/70 text-sm leading-relaxed">
                          {item.desc}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </section>

            </motion.div>
          ) : activeTab === 'tools' ? (
            <motion.div
              key="tools"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {selectedTool ? (
                <ToolView toolId={selectedTool} />
              ) : (
                <div className="max-w-7xl mx-auto px-6">
                  <div className="text-center mb-16">
                    <h2 className="text-4xl font-bold mb-4">Professional Image Tools</h2>
                    <p className="text-slate-600 dark:text-slate-400">Everything you need to process and optimize your images in one place.</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {TOOLS.map(tool => (
                      <motion.button 
                        key={tool.id}
                        whileHover={{ y: -5 }}
                        onClick={() => selectTool(tool.id)}
                        className="bg-white dark:bg-zinc-950 p-4 md:p-8 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-blue-600 hover:shadow-xl transition-all group text-left"
                      >
                        <div className={`w-14 h-14 ${tool.color} rounded-xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                          <tool.icon className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">{tool.name}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">{tool.description}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : activeTab === 'features' ? (
            <motion.div
              key="features"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Features Grid */}
              <section className="py-24" id="features">
                <div className="max-w-7xl mx-auto px-6">
                  <div className="text-center mb-20">
                    <h2 className="text-4xl font-bold mb-4">Everything you need to host images</h2>
                    <p className="text-slate-600 dark:text-white/80 max-w-2xl mx-auto">Built for developers and teams who value speed, security, and developer experience.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {[
                      { icon: Shield, title: 'Permanent Storage', desc: 'Your images are stored indefinitely. Links never expire, ensuring your assets are always available.' },
                      { icon: Zap, title: 'Unlimited Capacity', desc: 'Upload as many images as you need. No limits on the number of files or bandwidth usage.' },
                      { icon: Terminal, title: 'API First Design', desc: 'Robust REST API allows you to automate uploads and integrate directly into your CI/CD pipeline.' },
                      { icon: BarChart3, title: 'Usage Insights', desc: 'Track views, bandwidth usage, and referrer sites for every image you host with us.' },
                      { icon: Users, title: 'Team Collaboration', desc: 'Shared workspaces for teams to manage assets collectively with role-based access control.' }
                    ].map((feature, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-600/10 rounded flex items-center justify-center">
                          <feature.icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-bold mb-2">{feature.title}</h4>
                          <p className="text-sm text-slate-500 dark:text-white/60 leading-relaxed">{feature.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-20 text-center">
                    <button 
                      onClick={() => setActiveTab('home')}
                      className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition-all"
                    >
                      Back to Home
                    </button>
                  </div>
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="pricing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <section className="py-24">
                <div className="max-w-7xl mx-auto px-6">
                  <div className="text-center mb-20">
                    <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
                    <p className="text-slate-600 dark:text-white/80 max-w-2xl mx-auto">Choose the plan that's right for you. All plans include access to our core image processing tools.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Free Plan */}
                    <div className={`bg-white dark:bg-zinc-950 p-8 rounded-3xl border ${plan === 'free' ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200 dark:border-zinc-800'} flex flex-col`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold">Free</h3>
                        {plan === 'free' && <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}
                      </div>
                      <p className="text-slate-500 text-sm mb-6">Perfect for individuals and small projects.</p>
                      <div className="mb-8">
                        <span className="text-4xl font-bold">₹0</span>
                        <span className="text-slate-500">/month</span>
                      </div>
                      <div className="mb-6 p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
                        <div className="flex justify-between text-xs font-bold mb-2">
                          <span>Daily Usage</span>
                          <span>{usageData.count}/5</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${usageData.count >= 5 ? 'bg-red-500' : 'bg-blue-600'}`}
                            style={{ width: `${Math.min((usageData.count / 5) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <ul className="space-y-4 mb-8 flex-1">
                        {[
                          '5 uploads / day',
                          'Standard processing speed',
                          'Basic image tools',
                          'Community support',
                          'Permanent links'
                        ].map((feature, i) => (
                          <li key={i} className="flex items-center gap-3 text-sm">
                            <Check className="w-4 h-4 text-green-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <button 
                        onClick={() => setPlan('free')}
                        className={`w-full py-3 rounded-xl border font-bold transition-all ${plan === 'free' ? 'bg-slate-100 dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 cursor-default' : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900'}`}
                      >
                        {plan === 'free' ? 'Current Plan' : 'Switch to Free'}
                      </button>
                    </div>

                    {/* Pro Plan */}
                    <div className={`bg-white dark:bg-zinc-950 p-8 rounded-3xl border-2 ${plan === 'pro' ? 'border-blue-600 ring-4 ring-blue-600/10' : 'border-blue-600'} flex flex-col relative`}>
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold">
                        MOST POPULAR
                      </div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold">Pro</h3>
                        {plan === 'pro' && <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}
                      </div>
                      <p className="text-slate-500 text-sm mb-6">For power users and creative professionals.</p>
                      <div className="mb-8">
                        <span className="text-4xl font-bold">₹49</span>
                        <span className="text-slate-500">/month</span>
                      </div>
                      <ul className="space-y-4 mb-8 flex-1">
                        {[
                          'Unlimited uploads',
                          'Priority processing speed',
                          'All advanced image tools',
                          'Priority email support',
                          'Custom domain support',
                          'No watermarks'
                        ].map((feature, i) => (
                          <li key={i} className="flex items-center gap-3 text-sm">
                            <Check className="w-4 h-4 text-blue-600" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <button 
                        onClick={() => setPlan('pro')}
                        className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${plan === 'pro' ? 'bg-blue-700 text-white cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'}`}
                      >
                        {plan === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
                      </button>
                    </div>

                    {/* Enterprise Plan */}
                    <div className={`bg-white dark:bg-zinc-950 p-8 rounded-3xl border ${plan === 'enterprise' ? 'border-purple-600 ring-2 ring-purple-600/20' : 'border-slate-200 dark:border-zinc-800'} flex flex-col`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold">Enterprise</h3>
                        {plan === 'enterprise' && <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}
                      </div>
                      <p className="text-slate-500 text-sm mb-6">Scalable solutions for large teams.</p>
                      <div className="mb-8">
                        <span className="text-4xl font-bold">₹99</span>
                        <span className="text-slate-500">/month</span>
                      </div>
                      <ul className="space-y-4 mb-8 flex-1">
                        {[
                          'Custom upload limits',
                          'Dedicated infrastructure',
                          'SSO & Advanced security',
                          '24/7 Phone support',
                          'Custom API integration',
                          'SLA guarantee'
                        ].map((feature, i) => (
                          <li key={i} className="flex items-center gap-3 text-sm">
                            <Check className="w-4 h-4 text-purple-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <button 
                        onClick={() => setPlan('enterprise')}
                        className={`w-full py-3 rounded-xl border font-bold transition-all ${plan === 'enterprise' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-600 cursor-default' : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900'}`}
                      >
                        {plan === 'enterprise' ? 'Current Plan' : 'Get Enterprise'}
                      </button>
                    </div>
                  </div>

                  {/* FAQ Section */}
                  <div className="mt-32 max-w-3xl mx-auto">
                    <h3 className="text-2xl font-bold mb-12 text-center">Frequently Asked Questions</h3>
                    <div className="space-y-8">
                      {[
                        { q: 'Can I cancel my subscription anytime?', a: 'Yes, you can cancel your subscription at any time from your account settings. You will continue to have access until the end of your billing period.' },
                        { q: 'Do you offer a free trial?', a: 'Yes, we offer a 14-day free trial for the Pro plan so you can experience all the advanced features before committing.' },
                        { q: 'What payment methods do you accept?', a: 'We accept all major credit cards, PayPal, and Apple Pay.' }
                      ].map((faq, i) => (
                        <div key={i}>
                          <h4 className="font-bold mb-2">{faq.q}</h4>
                          <p className="text-sm text-slate-500 dark:text-white/60">{faq.a}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-20 text-center">
                    <button 
                      onClick={() => setActiveTab('home')}
                      className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition-all"
                    >
                      Back to Home
                    </button>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-zinc-900 bg-white dark:bg-black py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <img 
                src="https://res.cloudinary.com/dqywq17cr/image/upload/v1772113455/tooldack_uploads/lhmln6criszu16t19rqb.jpg" 
                alt="Tooldack Logo" 
                className="h-16 w-auto object-contain" 
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs leading-relaxed">
              The modern standard for image hosting and optimization. Delivering assets at the speed of light.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><button onClick={() => setActiveTab('features')} className="hover:text-blue-600">Features</button></li>
              <li><button onClick={() => setActiveTab('tools')} className="hover:text-blue-600">API</button></li>
              <li><button onClick={() => setActiveTab('pricing')} className="hover:text-blue-600">Pricing</button></li>
              <li><a href="#" className="hover:text-blue-600">Roadmap</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-blue-600">Documentation</a></li>
              <li><a href="#" className="hover:text-blue-600">Guides</a></li>
              <li><a href="#" className="hover:text-blue-600">Support</a></li>
              <li><a href="#" className="hover:text-blue-600">Security</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-blue-600">About</a></li>
              <li><a href="#" className="hover:text-blue-600">Blog</a></li>
              <li><a href="#" className="hover:text-blue-600">Careers</a></li>
              <li><a href="#" className="hover:text-blue-600">Privacy</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-400">© 2024 Tooldack Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-2">
              <Twitter className="w-4 h-4" />
              <span className="text-xs font-bold">TWITTER</span>
            </a>
            <a 
              href="https://www.instagram.com/abhishya.co?igsh=MTc0M2NjdDd2aHRjaQ==" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-slate-400 hover:text-pink-600 transition-colors flex items-center gap-2"
            >
              <Instagram className="w-4 h-4" />
              <span className="text-xs font-bold">INSTAGRAM</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
