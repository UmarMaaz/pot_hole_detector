
import React, { useRef, useEffect, useState } from 'react';
import { Detection, HazardType } from '../types';

interface CameraFeedProps {
  detections: Detection[];
  isActive: boolean;
  isLearningMode: boolean;
  onAreaSelected: (rect: { x: number, y: number, w: number, h: number }, uploadedImage?: string | null) => void;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ detections, isActive, isLearningMode, onAreaSelected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [selectionRect, setSelectionRect] = useState<{x: number, y: number, w: number, h: number} | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera not supported. Please upload an image.');
        return;
      }
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        setStream(mediaStream);
        setCameraError(null);
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      } catch (err) {
        console.error("Camera access denied:", err);
        setCameraError('Camera access denied. Please upload an image.');
      }
    }

    if (isActive && !stream && !uploadedImage) {
      startCamera();
    }
    return () => stream?.getTracks().forEach(track => track.stop());
  }, [isActive, stream, uploadedImage]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const img = new Image();
          img.onload = () => {
            setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            setUploadedImage(event.target!.result as string);
            if (stream) {
              stream.getTracks().forEach(track => track.stop());
              setStream(null);
            }
          };
          img.src = event.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('changedTouches' in e && (e as React.TouchEvent).changedTouches.length > 0) {
        clientX = (e as React.TouchEvent).changedTouches[0].clientX;
        clientY = (e as React.TouchEvent).changedTouches[0].clientY;
      } else {
        return { x: 0, y: 0 };
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isLearningMode) return;
    e.preventDefault();
    const pos = getCoords(e);
    setStartPos(pos);
    setCurrentPos(pos);
    setIsDragging(true);
    setSelectionRect(null);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const pos = getCoords(e);
    setCurrentPos(pos);
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.min(startPos.x, pos.x);
      const y = Math.min(startPos.y, pos.y);
      const w = Math.abs(pos.x - startPos.x);
      const h = Math.abs(pos.y - startPos.y);
      setSelectionRect({ x, y, w, h });
    }
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    setIsDragging(false);
    setSelectionRect(null);

    const containerRect = containerRef.current.getBoundingClientRect();
    
    const x1 = Math.min(startPos.x, currentPos.x) / containerRect.width;
    const y1 = Math.min(startPos.y, currentPos.y) / containerRect.height;
    const x2 = Math.max(startPos.x, currentPos.x) / containerRect.width;
    const y2 = Math.max(startPos.y, currentPos.y) / containerRect.height;

    const normalizedX = Math.max(0, Math.min(1, x1));
    const normalizedY = Math.max(0, Math.min(1, y1));
    const normalizedW = Math.max(0, Math.min(1 - normalizedX, x2 - x1));
    const normalizedH = Math.max(0, Math.min(1 - normalizedY, y2 - y1));

    if (normalizedW > 0.01 && normalizedH > 0.01) {
      onAreaSelected({ x: normalizedX, y: normalizedY, w: normalizedW, h: normalizedH }, uploadedImage);
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

      requestAnimationFrame(render);
    };
    render();
  }, [detections]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black flex items-center justify-center overflow-hidden transition-all touch-none ${isLearningMode ? 'custom-cursor' : ''}`}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      {!uploadedImage ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="absolute w-full h-full object-cover grayscale-[0.1] brightness-[0.7]" />
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-5">
              <div className="text-center p-4">
                <div className="text-orange-500 font-bold text-sm mb-2">{cameraError}</div>
                <label className="px-4 py-2 bg-orange-500 text-black rounded-lg font-bold text-sm cursor-pointer">
                  Upload Image
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}
        </>
      ) : (
        <img
          src={uploadedImage}
          alt="Uploaded for training"
          className="absolute w-full h-full object-cover grayscale-[0.1] brightness-[0.7]"
          draggable={false}
        />
      )}

      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.6)_100%)]"></div>

      <canvas ref={canvasRef} width={1280} height={720} className="absolute w-full h-full object-cover pointer-events-none z-10" />

      {selectionRect && isLearningMode && (
        <div
          className="absolute border-4 border-orange-500 bg-orange-500/20 pointer-events-none z-30"
          style={{
            left: `${selectionRect.x}px`,
            top: `${selectionRect.y}px`,
            width: `${selectionRect.w}px`,
            height: `${selectionRect.h}px`,
            borderStyle: 'dashed'
          }}
        />
      )}

      {isLearningMode && (
        <>
          <div className="absolute inset-0 bg-orange-500/10 pointer-events-none border-4 sm:border-[10px] md:border-[20px] border-orange-500/10 flex items-center justify-center z-20">
            {!isDragging && (
              <div className="bg-orange-500/90 backdrop-blur-xl text-black px-4 sm:px-8 py-2 sm:py-3 font-black text-[8px] sm:text-[10px] tracking-[0.1em] sm:tracking-[0.2em] rounded-full shadow-2xl flex items-center gap-2 sm:gap-4 animate-bounce uppercase">
                Draw box around pothole
              </div>
            )}
          </div>

          <div className="absolute top-20 sm:top-4 left-2 sm:left-4 z-[100]">
            <label className="px-3 sm:px-4 py-2 bg-orange-500 text-black rounded-lg font-bold text-xs sm:text-sm cursor-pointer shadow-lg">
              Upload Image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          {uploadedImage && (
            <div className="absolute top-20 sm:top-4 right-2 sm:right-4 z-[100]">
              <button
                onClick={() => {
                  setUploadedImage(null);
                  setImageDimensions({ width: 0, height: 0 });
                  if (!stream && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    const startCamera = async () => {
                      try {
                        const mediaStream = await navigator.mediaDevices.getUserMedia({
                          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                          audio: false
                        });
                        setStream(mediaStream);
                        setCameraError(null);
                        if (videoRef.current) videoRef.current.srcObject = mediaStream;
                      } catch (err) {
                        console.error("Camera access denied:", err);
                        setCameraError('Camera access denied.');
                      }
                    };
                    startCamera();
                  }
                }}
                className="px-3 sm:px-4 py-2 bg-gray-700 text-white rounded-lg font-bold text-xs sm:text-sm shadow-lg"
              >
                Use Camera
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CameraFeed;
