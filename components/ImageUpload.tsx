import React, { useState, useRef, useEffect } from 'react';
import { HazardType, Detection, LearnedSample } from '../types';

interface ImageUploadProps {
  onDetectionsChange: (detections: Detection[]) => void;
  onTrainWithSamples?: (samples: LearnedSample[]) => Promise<void>;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onDetectionsChange, onTrainWithSamples }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
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

  const handleTrainWithImage = async () => {
    if (!selectedImage || detections.length === 0) return;

    setIsTraining(true);

    // Process each detection to create a learned sample
    const samples: LearnedSample[] = [];

    for (const detection of detections) {
      if (!detection.bbox) continue;

      // Extract the region of interest from the image
      const img = imageRef.current;
      if (!img) continue;

      // Create a canvas to extract the cropped region
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const [y1, x1, y2, x2] = detection.bbox;
      const cropX = x1 * img.naturalWidth;
      const cropY = y1 * img.naturalHeight;
      const cropWidth = (x2 - x1) * img.naturalWidth;
      const cropHeight = (y2 - y1) * img.naturalHeight;

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );

      // Create thumbnail from the cropped image
      const thumbnail = canvas.toDataURL('image/jpeg', 0.8);

      // In a real implementation, we would generate embeddings using the image embedder
      // For now, we'll simulate with random values
      const embedding = Array.from({ length: 128 }, () => Math.random());

      // Create a learned sample
      const newSample: LearnedSample = {
        id: `learned-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        embedding,
        thumbnail,
        timestamp: Date.now()
      };

      samples.push(newSample);
    }

    // Call the training function if provided
    if (samples.length > 0 && onTrainWithSamples) {
      try {
        await onTrainWithSamples(samples);
        setIsTraining(false);
        alert(`Successfully trained with ${samples.length} pothole samples from your image!`);
      } catch (error) {
        console.error('Training failed:', error);
        setIsTraining(false);
        alert('Training failed. Please try again.');
      }
    } else {
      // Fallback if no training function is provided
      setIsTraining(false);
      alert(`Created ${samples.length} training samples from your image!`);
    }
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
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={handleDetectAutomatically}
              disabled={isDetecting}
              className="px-4 py-2 bg-orange-500 text-black rounded-lg font-bold disabled:opacity-50"
            >
              {isDetecting ? 'Detecting...' : 'Auto-Detect Potholes'}
            </button>
            <button
              onClick={handleTrainWithImage}
              disabled={isTraining || detections.length === 0}
              className="px-4 py-2 bg-emerald-500 text-black rounded-lg font-bold disabled:opacity-50"
            >
              {isTraining ? 'Training...' : `Train with ${detections.length} Marked Areas`}
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
            <p><strong>Tip:</strong> Click and drag on the image to mark potholes, then click "Train" to teach the AI.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;