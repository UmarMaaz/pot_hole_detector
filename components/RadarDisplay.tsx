
import React from 'react';
import { SensorState } from '../types';

interface RadarDisplayProps {
  sensors: SensorState;
}

const RadarDisplay: React.FC<RadarDisplayProps> = ({ sensors }) => {
  const getStrokeColor = (distance: number) => {
    if (distance < 0.5) return 'stroke-red-500';
    if (distance < 1.5) return 'stroke-yellow-400';
    return 'stroke-emerald-400 opacity-20';
  };

  return (
    <div className="relative w-40 h-40 bg-slate-950/40 backdrop-blur-xl rounded-full border border-white/5 flex items-center justify-center overflow-hidden shadow-2xl">
      <svg viewBox="0 0 100 100" className="w-full h-full p-1.5">
        {/* Radar Rings */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="white" strokeOpacity="0.03" strokeWidth="1" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="white" strokeOpacity="0.03" strokeWidth="1" />
        <circle cx="50" cy="50" r="15" fill="none" stroke="white" strokeOpacity="0.03" strokeWidth="1" />
        
        {/* Car Silhouette - Futuristic Style */}
        <rect x="44" y="38" width="12" height="24" rx="2" fill="white" fillOpacity="0.1" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
        
        {/* Dynamic Scan Line */}
        <line x1="50" y1="50" x2="50" y2="5" stroke="orange" strokeOpacity="0.2" strokeWidth="0.5" className="origin-center animate-[spin_4s_linear_infinite]" />

        {/* Sensor Arcs */}
        <path d="M 35 15 Q 50 5 65 15" fill="none" strokeWidth="4" strokeLinecap="round" className={getStrokeColor(sensors.front)} />
        <path d="M 15 35 Q 5 50 15 65" fill="none" strokeWidth="4" strokeLinecap="round" className={getStrokeColor(sensors.left)} />
        <path d="M 85 35 Q 95 50 85 65" fill="none" strokeWidth="4" strokeLinecap="round" className={getStrokeColor(sensors.right)} />
        <path d="M 35 85 Q 50 95 65 85" fill="none" strokeWidth="4" strokeLinecap="round" className={getStrokeColor(sensors.back)} />
      </svg>
      
      <div className="absolute top-2 text-[7px] font-black tracking-[0.3em] text-slate-500 uppercase">Proximity</div>
    </div>
  );
};

export default RadarDisplay;
