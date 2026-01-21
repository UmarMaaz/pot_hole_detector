
import React, { useRef, useEffect, useState } from 'react';
import { Detection, HazardType } from '../types';

interface CameraFeedProps {
  detections: Detection[];
  isActive: boolean;
  isLearningMode: boolean;
  onAreaSelected: (rect: { x: number, y: number, w: number, h: number }) => void;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ detections, isActive, isLearningMode, onAreaSelected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false 
        });
        setStream(mediaStream);
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    }
    if (isActive && !stream) startCamera();
    return () => stream?.getTracks().forEach(track => track.stop());
  }, [isActive, stream]);

  // Support both Mouse and Touch
  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isLearningMode) return;
    const pos = getCoords(e);
    setStartPos(pos);
    setCurrentPos(pos);
    setIsDragging(true);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    setCurrentPos(getCoords(e));
  };

  const handleEnd = () => {
    if (!isDragging || !containerRef.current) return;
    setIsDragging(false);
    const rect = containerRef.current.getBoundingClientRect();
    const x1 = Math.min(startPos.x, currentPos.x) / rect.width;
    const y1 = Math.min(startPos.y, currentPos.y) / rect.height;
    const x2 = Math.max(startPos.x, currentPos.x) / rect.width;
    const y2 = Math.max(startPos.y, currentPos.y) / rect.height;
    const w = x2 - x1;
    const h = y2 - y1;
    if (w > 0.01 && h > 0.01) {
        onAreaSelected({ x: x1, y: y1, w, h });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      detections.forEach(det => {
        if (!det.bbox) return;
        const [y_min, x_min, y_max, x_max] = det.bbox;
        const x = x_min * canvas.width;
        const y = y_min * canvas.height;
        const w = (x_max - x_min) * canvas.width;
        const h = (y_max - y_min) * canvas.height;

        let color = '#38bdf8'; 
        if (det.type === HazardType.LEARNED) color = '#f97316';
        if (det.type === HazardType.COLLISION_RISK) color = '#ef4444';

        ctx.strokeStyle = color;
        ctx.lineWidth = det.type === HazardType.LEARNED ? 4 : 2;
        ctx.strokeRect(x, y, w, h);

        // Responsive Labeling
        const fontSize = canvas.width < 800 ? 18 : 12;
        ctx.font = `black ${fontSize}px ui-monospace, monospace`;
        const mainLabel = det.label || det.type;
        const scoreLabel = det.matchScore ? ` ${Math.round(det.matchScore * 100)}%` : '';
        const fullText = `${mainLabel}${scoreLabel}`.toUpperCase();
        
        const tw = ctx.measureText(fullText).width;
        const padding = fontSize * 0.6;
        ctx.fillStyle = color;
        ctx.fillRect(x, y - (fontSize + padding), tw + padding * 2, fontSize + padding);
        
        ctx.fillStyle = 'black';
        ctx.fillText(fullText, x + padding, y - padding/2 - 2);
      });

      if (isDragging) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.min(startPos.x, currentPos.x) * scaleX;
            const y = Math.min(startPos.y, currentPos.y) * scaleY;
            const w = Math.abs(currentPos.x - startPos.x) * scaleX;
            const h = Math.abs(currentPos.y - startPos.y) * scaleY;
            ctx.strokeStyle = '#f97316';
            ctx.setLineDash([10, 10]);
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = 'rgba(249, 115, 22, 0.2)';
            ctx.fillRect(x, y, w, h);
            ctx.setLineDash([]);
        }
      }
      requestAnimationFrame(render);
    };
    render();
  }, [detections, isDragging, startPos, currentPos]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full bg-black flex items-center justify-center overflow-hidden transition-all ${isLearningMode ? 'custom-cursor' : ''}`}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      <video ref={videoRef} autoPlay playsInline muted className="absolute w-full h-full object-cover grayscale-[0.1] brightness-[0.7]" />
      
      {/* HUD Vignette for Contrast */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.6)_100%)]"></div>
      
      <canvas ref={canvasRef} width={1280} height={720} className="absolute w-full h-full object-cover pointer-events-none z-10" />
      
      {isLearningMode && (
          <div className="absolute inset-0 bg-orange-500/10 pointer-events-none border-[20px] border-orange-500/10 flex items-center justify-center z-20">
              <div className="bg-orange-500/90 backdrop-blur-xl text-black px-8 py-3 font-black text-[10px] tracking-[0.2em] rounded-full shadow-2xl flex items-center gap-4 animate-bounce uppercase">
                  Select Visual Signature
              </div>
          </div>
      )}
    </div>
  );
};

export default CameraFeed;
