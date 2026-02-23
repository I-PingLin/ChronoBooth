import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Wand2, History, Search, RefreshCw, X } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ERAS = [
  { id: 'egypt', name: 'Ancient Egypt', prompt: 'Transform this person into an Ancient Egyptian pharaoh or royalty, with pyramids in the background, keeping their face recognizable.' },
  { id: 'rome', name: 'Ancient Rome', prompt: 'Transform this person into an Ancient Roman gladiator or senator in the Colosseum, keeping their face recognizable.' },
  { id: 'medieval', name: 'Medieval Times', prompt: 'Transform this person into a Medieval knight or royalty in a castle, keeping their face recognizable.' },
  { id: 'renaissance', name: 'Renaissance', prompt: 'Transform this person into a Renaissance noble in a classic oil painting style, keeping their face recognizable.' },
  { id: 'pirate', name: 'Golden Age of Piracy', prompt: 'Transform this person into a pirate captain on a ship, keeping their face recognizable.' },
  { id: 'wildwest', name: 'Wild West', prompt: 'Transform this person into a Wild West cowboy or outlaw in a dusty town, keeping their face recognizable.' },
  { id: 'victorian', name: 'Victorian Era', prompt: 'Transform this person into a Victorian era gentleperson in 19th century London, keeping their face recognizable.' },
  { id: '1920s', name: 'Roaring 20s', prompt: 'Transform this person into a 1920s flapper or mobster in a speakeasy, keeping their face recognizable.' },
  { id: '1980s', name: '1980s Neon', prompt: 'Transform this person into an 80s synthwave character with neon lights and retro fashion, keeping their face recognizable.' },
  { id: 'cyberpunk', name: 'Cyberpunk Future', prompt: 'Transform this person into a futuristic cyberpunk character in a neon-lit dystopian city, keeping their face recognizable.' },
];

const editImage = async (base64DataUrl: string, prompt: string) => {
  const match = base64DataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data");
  const mimeType = match[1];
  const base64Data = match[2];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        {
          text: prompt,
        },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image returned from the model.");
};

const analyzeImage = async (base64DataUrl: string) => {
  const match = base64DataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data");
  const mimeType = match[1];
  const base64Data = match[2];

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        {
          text: "Analyze this image in detail. Describe the person, their clothing, the setting, and the overall mood or historical context if applicable.",
        },
      ],
    },
  });

  return response.text;
};

const CameraView = ({ onCapture, onCancel }: { onCapture: (img: string) => void, onCancel: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream;
        }
      } catch (err) {
        console.error("Error accessing camera", err);
      }
    };
    startCamera();
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');
        onCapture(base64);
      }
    }
  };

  return (
    <div className="relative rounded-3xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center border border-white/10 shadow-2xl">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
        <button onClick={onCancel} className="p-4 rounded-full bg-white/10 backdrop-blur hover:bg-white/20 text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
        <button onClick={capture} className="p-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-colors">
          <Camera className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'time-travel' | 'edit' | 'analyze'>('time-travel');
  const [customPrompt, setCustomPrompt] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const handleCapture = (base64: string) => {
    setOriginalImage(base64);
    setCurrentImage(base64);
    setShowCamera(false);
    setError(null);
    setAnalysisResult(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleCapture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetAll = () => {
    setOriginalImage(null);
    setCurrentImage(null);
    setAnalysisResult(null);
    setError(null);
    setCustomPrompt('');
  };

  const handleTimeTravel = async (prompt: string) => {
    if (!originalImage) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await editImage(originalImage, prompt);
      setCurrentImage(result);
      setAnalysisResult(null);
    } catch (err: any) {
      setError(err.message || "Failed to edit image");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCustomEdit = async () => {
    if (!currentImage || !customPrompt.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await editImage(currentImage, customPrompt);
      setCurrentImage(result);
      setCustomPrompt('');
      setAnalysisResult(null);
    } catch (err: any) {
      setError(err.message || "Failed to edit image");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!currentImage) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await analyzeImage(currentImage);
      setAnalysisResult(result);
    } catch (err: any) {
      setError(err.message || "Failed to analyze image");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <header className="border-b border-white/10 bg-slate-950/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400">
            <History className="w-6 h-6" />
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">ChronoBooth</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!originalImage ? (
          <div className="max-w-2xl mx-auto">
            {showCamera ? (
              <CameraView onCapture={handleCapture} onCancel={() => setShowCamera(false)} />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <button onClick={() => setShowCamera(true)} className="flex flex-col items-center justify-center gap-4 p-12 rounded-3xl border-2 border-dashed border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group">
                  <div className="p-4 rounded-full bg-white/5 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                    <Camera className="w-8 h-8" />
                  </div>
                  <span className="font-medium">Take a Photo</span>
                </button>
                <label className="flex flex-col items-center justify-center gap-4 p-12 rounded-3xl border-2 border-dashed border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  <div className="p-4 rounded-full bg-white/5 group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                    <Upload className="w-8 h-8" />
                  </div>
                  <span className="font-medium">Upload Photo</span>
                </label>
              </div>
            )}
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
            {/* Left Column: Image Preview */}
            <div className="space-y-4">
              <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-white/10 aspect-[4/3] flex items-center justify-center shadow-2xl">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentImage}
                    src={currentImage || originalImage}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.3 }}
                  />
                </AnimatePresence>
                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-4">
                      <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                      <span className="text-sm font-medium animate-pulse">Processing...</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center px-2">
                <button onClick={resetAll} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
                  Start Over
                </button>
                {currentImage !== originalImage && (
                  <button onClick={() => setCurrentImage(originalImage)} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
                    View Original
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Controls */}
            <div className="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden flex flex-col h-[600px] shadow-2xl">
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setActiveTab('time-travel')}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === 'time-travel' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <History className="w-4 h-4" />
                  Time Travel
                </button>
                <button
                  onClick={() => setActiveTab('edit')}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === 'edit' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <Wand2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => setActiveTab('analyze')}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${activeTab === 'analyze' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  <Search className="w-4 h-4" />
                  Analyze
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                {error && (
                  <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}
                
                {activeTab === 'time-travel' && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400">Select an era to travel to. This will use your original photo.</p>
                    <div className="grid grid-cols-2 gap-3">
                      {ERAS.map(era => (
                        <button
                          key={era.id}
                          onClick={() => handleTimeTravel(era.prompt)}
                          disabled={isProcessing}
                          className="p-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                          <span className="block text-sm font-medium text-slate-200 group-hover:text-indigo-300 transition-colors">{era.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'edit' && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400">Describe how you want to edit the current image.</p>
                    <textarea
                      value={customPrompt}
                      onChange={e => setCustomPrompt(e.target.value)}
                      placeholder="e.g., Add a retro filter, make it look like a painting, remove the background..."
                      className="w-full h-32 p-4 rounded-2xl bg-black/50 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none text-sm placeholder:text-slate-600"
                    />
                    <button
                      onClick={handleCustomEdit}
                      disabled={isProcessing || !customPrompt.trim()}
                      className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Wand2 className="w-4 h-4" />
                      Apply Edit
                    </button>
                  </div>
                )}

                {activeTab === 'analyze' && (
                  <div className="space-y-6">
                    <p className="text-sm text-slate-400">Analyze the current image to discover its story and details.</p>
                    <button
                      onClick={handleAnalyze}
                      disabled={isProcessing}
                      className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      Analyze Image
                    </button>
                    
                    {analysisResult && (
                      <div className="prose prose-invert prose-sm max-w-none p-4 rounded-2xl bg-black/30 border border-white/5">
                        <div className="markdown-body text-slate-300 text-sm">
                          <ReactMarkdown>{analysisResult}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
