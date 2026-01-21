
export enum HazardType {
  POTHOLE = 'POTHOLE',
  COLLISION_RISK = 'COLLISION_RISK',
  PEDESTRIAN = 'PEDESTRIAN',
  VEHICLE = 'VEHICLE',
  LEARNED = 'LEARNED'
}

export interface Detection {
  id: string;
  type: HazardType;
  confidence: number;
  bbox?: [number, number, number, number]; // [y_min, x_min, y_max, x_max]
  distance?: number; 
  timestamp: number;
  label?: string;
  matchScore?: number; // How closely it matches learned data
}

export interface LearnedSample {
  id: string;
  embedding: number[];
  thumbnail: string;
  timestamp: number;
}

export interface SensorState {
  front: number;
  back: number;
  left: number;
  right: number;
  frontLeft: number;
  frontRight: number;
}

export interface PotholeRecord {
  id: string;
  lat: number;
  lng: number;
  severity: string;
  timestamp: number;
  type: string;
}
