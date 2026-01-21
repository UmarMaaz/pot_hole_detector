
import React, { useState, useEffect, useRef } from 'react';
import { HazardType, Detection, SensorState, LearnedSample } from './types';
import CameraFeed from './components/CameraFeed';
import RadarDisplay from './components/RadarDisplay';
import { initLocalModel, processDetections, computeCosineSimilarity } from './services/localModelService';
import { potholeService, isSupabaseConfigured } from './services/supabaseClient';

const STORAGE_KEY = 'neural_observer_local_memory';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'drive' | 'memory'>('drive');
  const [isLearningMode, setIsLearningMode] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [learnedSamples, setLearnedSamples] = useState<LearnedSample[]>([]);
  const [sensors] = useState<SensorState>({ front: 5, back: 5, left: 5, right: 5, frontLeft: 5, frontRight: 5 });
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const requestRef = useRef<number>(0);
  const modelsRef = useRef<{objectDetector: any, imageEmbedder: any} | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const learnedSamplesRef = useRef<LearnedSample[]>([]);

  useEffect(() => {
    const loadMemory = async () => {
        try {
            setIsSyncing(true);
            let data: LearnedSample[] = [];
            if (isSupabaseConfigured) {
                data = await potholeService.getAll();
            } else {
                const localData = localStorage.getItem(STORAGE_KEY);
                if (localData) data = JSON.parse(localData);
            }
            setLearnedSamples(data);
            learnedSamplesRef.current = data;
        } catch (e) {
            console.error("Memory initialization failed:", e);
        } finally {
            setIsSyncing(false);
        }
    };
    loadMemory();
  }, []);

  useEffect(() => {
    learnedSamplesRef.current = learnedSamples;
    if (!isSupabaseConfigured) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(learnedSamples));
    }
  }, [learnedSamples]);

  useEffect(() => {
    cropCanvasRef.current = document.createElement('canvas');
    cropCanvasRef.current.width = 224;
    cropCanvasRef.current.height = 224;

    initLocalModel().then(m => {
        modelsRef.current = m;
        setIsModelLoading(false);
        animate();
    });
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  const animate = async () => {
    const video = document.querySelector('video') as HTMLVideoElement;
    const { objectDetector, imageEmbedder } = modelsRef.current || {};
    const cropCanvas = cropCanvasRef.current;
    
    if (video && video.readyState >= 2 && objectDetector && imageEmbedder && cropCanvas) {
      const startTime = performance.now();
      const results = objectDetector.detectForVideo(video, startTime);
      const rawCandidates = processDetections(results);
      const currentLearned = learnedSamplesRef.current;
      const matchedDetections: Detection[] = [];

      if (currentLearned.length > 0) {
        const ctx = cropCanvas.getContext('2d', { willReadFrequently: true });
        for (let i = 0; i < rawCandidates.length; i++) {
          const det = rawCandidates[i];
          if (!det.bbox) continue;
          const [y1, x1, y2, x2] = det.bbox;
          const vx = x1 * video.videoWidth;
          const vy = y1 * video.videoHeight;
          const vw = (x2 - x1) * video.videoWidth;
          const vh = (y2 - y1) * video.videoHeight;

          if (vw > 10 && vh > 10 && ctx) {
            ctx.clearRect(0, 0, 224, 224);
            ctx.drawImage(video, vx, vy, vw, vh, 0, 0, 224, 224);
            const embeddingResult = imageEmbedder.embed(cropCanvas);
            if (embeddingResult.embeddings && embeddingResult.embeddings[0]) {
                const currentVector = Array.from(embeddingResult.embeddings[0].floatEmbedding as Float32Array);
                let bestScore = 0;
                for (const sample of currentLearned) {
                  const score = computeCosineSimilarity(currentVector, sample.embedding);
                  if (score > bestScore) bestScore = score;
                }
                if (bestScore > 0.48) {
                  matchedDetections.push({ 
                    ...det, 
                    type: HazardType.LEARNED, 
                    label: 'TRAINED HAZARD', 
                    matchScore: bestScore,
                    confidence: bestScore
                  });
                }
            }
          }
        }
      }
      setDetections(matchedDetections);
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  const handleAreaSelected = async (rect: { x: number, y: number, w: number, h: number }) => {
    const video = document.querySelector('video') as HTMLVideoElement;
    const { imageEmbedder } = modelsRef.current || {};
    if (!video || !imageEmbedder) return;

    setIsSyncing(true);
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 120;
    thumbCanvas.height = 120;
    const tCtx = thumbCanvas.getContext('2d');
    tCtx?.drawImage(video, rect.x * video.videoWidth, rect.y * video.videoHeight, rect.w * video.videoWidth, rect.h * video.videoHeight, 0, 0, 120, 120);
    const thumb = thumbCanvas.toDataURL('image/jpeg');

    const trainCropCanvas = document.createElement('canvas');
    trainCropCanvas.width = 224;
    trainCropCanvas.height = 224;
    const cCtx = trainCropCanvas.getContext('2d');
    cCtx?.drawImage(video, rect.x * video.videoWidth, rect.y * video.videoHeight, rect.w * video.videoWidth, rect.h * video.videoHeight, 0, 0, 224, 224);
    
    const embeddingResult = imageEmbedder.embed(trainCropCanvas);
    if (!embeddingResult.embeddings || !embeddingResult.embeddings[0]) {
        setIsSyncing(false);
        return;
    }
    const vector = Array.from(embeddingResult.embeddings[0].floatEmbedding as Float32Array);
    const newSample: LearnedSample = { id: `learned-${Date.now()}`, embedding: vector, thumbnail: thumb, timestamp: Date.now() };

    try {
        if (isSupabaseConfigured) await potholeService.insert(newSample);
        setLearnedSamples(prev => [newSample, ...prev]);
        setIsLearningMode(false);
        const audio = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.connect(gain); gain.connect(audio.destination);
        osc.frequency.setValueAtTime(1000, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audio.currentTime + 0.2);
        osc.start(); osc.stop(audio.currentTime + 0.2);
    } catch (err) {
        console.error("Failed to sync new hazard:", err);
    } finally {
        setIsSyncing(false);
    }
  };

  const handleDeleteSample = async (id: string) => {
    setIsSyncing(true);
    try {
        if (isSupabaseConfigured) await potholeService.delete(id);
        setLearnedSamples(prev => prev.filter(s => s.id !== id));
    } catch (err) { console.error("Delete failed:", err); } 
    finally { setIsSyncing(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-slate-100 font-sans select-none overflow-hidden">
      
      {/* Dynamic Header */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-950/60 backdrop-blur-2xl border-b border-white/5 p-4 safe-top">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
               <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.744c0 3.89 2.421 7.221 5.823 8.513l.375.142.375-.142A11.99 11.99 0 0021 9.744c0-1.39-.238-2.724-.677-3.969L19.5 5.25m-10.5-2.25l.33.11c.113.038.23.056.347.056h1.646c.117 0 .234-.018.347-.056l.33-.11" /></svg>
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tighter uppercase italic leading-none">Neural <span className="text-orange-500">Observer</span></h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-1 h-1 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                <span className="text-[7px] text-slate-400 font-black tracking-[0.2em] uppercase">
                    {isSupabaseConfigured ? 'Cloud Link Active' : 'Local Node'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSyncing && <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>}
            <button 
                onClick={() => { setActiveTab('drive'); setIsLearningMode(!isLearningMode); }}
                className={`h-9 px-4 rounded-full text-[9px] font-black tracking-widest uppercase transition-all flex items-center gap-2 ${isLearningMode ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 border border-white/10 text-orange-500 hover:bg-orange-500/10'}`}
            >
                {isLearningMode ? 'EXIT' : 'Train'}
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 relative overflow-hidden flex flex-col pt-16 pb-20">
        {isModelLoading && (
          <div className="absolute inset-0 z-[60] bg-slate-950 flex flex-col items-center justify-center p-10 text-center">
             <div className="relative w-20 h-20 mb-8">
                <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
             </div>
             <div className="text-orange-500 font-black text-xs tracking-[0.5em] uppercase">Booting Neural Engine...</div>
          </div>
        )}

        {activeTab === 'drive' ? (
          <div className="flex-1 relative">
            <CameraFeed detections={detections} isActive={true} isLearningMode={isLearningMode} onAreaSelected={handleAreaSelected} />
            
            {/* HUD Overlays - Positioned for Mobile Safe Zones */}
            <div className="absolute inset-x-0 bottom-4 px-4 flex flex-col gap-4 pointer-events-none transition-all duration-500 ease-out">
                {detections.length > 0 && (
                    <div className="self-center px-6 py-2 bg-orange-500 text-black rounded-full font-black text-[10px] tracking-widest uppercase shadow-2xl shadow-orange-500/40 animate-danger">
                        NEURAL HAZARD DETECTED
                    </div>
                )}
                
                <div className="flex justify-between items-end">
                    <div className="scale-75 origin-bottom-left">
                        <RadarDisplay sensors={sensors} />
                    </div>

                    <div className="bg-slate-900/40 backdrop-blur-xl p-3 rounded-2xl border border-white/5 w-48 shadow-2xl">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[8px] font-black text-slate-400 tracking-tighter uppercase">Memory Bank</span>
                            <span className="text-[10px] font-black text-orange-500">{learnedSamples.length}</span>
                        </div>
                        <div className="flex -space-x-1.5 overflow-hidden">
                            {learnedSamples.slice(0, 5).map(s => (
                                <div key={s.id} className="w-6 h-6 rounded-full border border-slate-900 overflow-hidden bg-slate-800">
                                    <img src={s.thumbnail} className="w-full h-full object-cover" />
                                </div>
                            ))}
                            {learnedSamples.length > 5 && (
                                <div className="w-6 h-6 rounded-full border border-slate-900 bg-slate-800 flex items-center justify-center text-[8px] font-bold">
                                    +{learnedSamples.length - 5}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-950">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8 flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter">Neural <span className="text-orange-500">Archives</span></h2>
                        <p className="text-slate-500 font-bold text-[9px] tracking-[0.2em] uppercase mt-1">
                            {isSupabaseConfigured ? 'Synced Cloud Database' : 'Local Persistent Node'}
                        </p>
                    </div>
                </header>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {learnedSamples.map(sample => (
                        <div key={sample.id} className="bg-slate-900/50 rounded-xl overflow-hidden border border-white/5 flex flex-col group active:scale-95 transition-transform">
                            <div className="aspect-square relative">
                                <img src={sample.thumbnail} className="w-full h-full object-cover opacity-80" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent"></div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteSample(sample.id); }}
                                    className="absolute top-2 right-2 w-6 h-6 bg-red-500/20 backdrop-blur-md rounded-full flex items-center justify-center text-red-500 border border-red-500/20"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-2 text-[8px] font-bold text-slate-500 uppercase tracking-tighter truncate">
                                ID: {sample.id.split('-')[1]}
                            </div>
                        </div>
                    ))}
                    {learnedSamples.length === 0 && (
                        <div className="col-span-full py-20 text-center rounded-3xl border border-white/5 bg-white/[0.02]">
                            <p className="text-slate-500 font-black text-[10px] tracking-[0.4em] uppercase">No signatures found</p>
                        </div>
                    )}
                </div>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation - Mobile Optimized */}
      <footer className="fixed bottom-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-3xl border-t border-white/5 p-3 safe-bottom">
        <div className="max-w-md mx-auto flex bg-white/5 p-1 rounded-2xl border border-white/5">
            <button 
                onClick={() => { setActiveTab('drive'); setIsLearningMode(false); }} 
                className={`flex-1 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'drive' ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20' : 'text-slate-500'}`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                HUD
            </button>
            <button 
                onClick={() => { setActiveTab('memory'); setIsLearningMode(false); }} 
                className={`flex-1 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'memory' ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20' : 'text-slate-500'}`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                Archives
            </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
