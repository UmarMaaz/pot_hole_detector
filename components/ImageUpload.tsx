import React, { useState, useRef, useEffect } from 'react';
import { HazardType, Detection } from '../types';

interface ImageUploadProps {
  onDetectionsChange: (detections: Detection[]) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onDetectionsChange }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedImage(event.target.result as string);
          setDetections([]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedImage) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPoint({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint) return;
    
    // Update UI to show selection rectangle (would be implemented with canvas or CSS)
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint || !selectedImage) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    // Calculate bounding box
    const minX = Math.min(startPoint.x, endX);
    const minY = Math.min(startPoint.y, endY);
    const maxX = Math.max(startPoint.x, endX);
    const maxY = Math.max(startPoint.y, endY);

    // Create detection object
    const newDetection: Detection = {
      id: `detection-${Date.now()}`,
      bbox: [minY / rect.height, minX / rect.width, maxY / rect.height, maxX / rect.width], // normalized coordinates
      confidence: 0.9, // default confidence for manual marking
      label: 'Pothole',
      type: HazardType.POTHOLE,
      timestamp: Date.now(),
      matchScore: 0.9
    };

    const updatedDetections = [...detections, newDetection];
    setDetections(updatedDetections);
    onDetectionsChange(updatedDetections);

    setIsDrawing(false);
    setStartPoint(null);
  };

  const handleDetectAutomatically = async () => {
    if (!selectedImage) return;

    setIsDetecting(true);

    // Simulate AI detection (in a real implementation, this would call your detection model)
    setTimeout(() => {
      // This would be replaced with actual AI detection logic
      const mockDetections: Detection[] = [
        {
          id: `detection-${Date.now()}-1`,
          bbox: [0.3, 0.4, 0.5, 0.6], // normalized coordinates
          confidence: 0.85,
          label: 'Pothole',
          type: HazardType.POTHOLE,
          timestamp: Date.now(),
          matchScore: 0.85
        },
        {
          id: `detection-${Date.now()}-2`,
          bbox: [0.6, 0.2, 0.7, 0.35],
          confidence: 0.78,
          label: 'Pothole',
          type: HazardType.POTHOLE,
          timestamp: Date.now(),
          matchScore: 0.78
        }
      ];

      setDetections(mockDetections);
      onDetectionsChange(mockDetections);
      setIsDetecting(false);
    }, 1500);
  };

  const handleClear = () => {
    setSelectedImage(null);
    setDetections([]);
    onDetectionsChange([]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-orange-50 text-orange-500
            hover:file:bg-orange-100"
        />
      </div>

      {selectedImage && (
        <div className="flex-1 flex flex-col">
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleDetectAutomatically}
              disabled={isDetecting}
              className="px-4 py-2 bg-orange-500 text-black rounded-lg font-bold disabled:opacity-50"
            >
              {isDetecting ? 'Detecting...' : 'Auto-Detect Potholes'}
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg font-bold"
            >
              Clear
            </button>
          </div>

          <div 
            className="relative flex-1 border-2 border-dashed border-gray-600 rounded-lg overflow-hidden bg-gray-900"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              ref={imageRef}
              src={selectedImage}
              alt="Uploaded"
              className="w-full h-full object-contain"
            />
            
            {/* Render detections as overlays */}
            {detections.map((detection, index) => {
              if (!detection.bbox || !imageRef.current) return null;
              
              const [top, left, bottom, right] = detection.bbox;
              const img = imageRef.current;
              const width = img.clientWidth;
              const height = img.clientHeight;
              
              return (
                <div
                  key={index}
                  className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20 flex items-center justify-center"
                  style={{
                    top: `${top * height}px`,
                    left: `${left * width}px`,
                    width: `${(right - left) * width}px`,
                    height: `${(bottom - top) * height}px`,
                  }}
                >
                  <span className="text-xs font-bold text-red-500 bg-black bg-opacity-70 px-1">
                    {detection.label} {Math.round(detection.confidence * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 text-sm text-gray-400">
            <p><strong>Tip:</strong> Click and drag on the image to manually mark potholes, or use "Auto-Detect" to run AI analysis.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;