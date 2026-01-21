# Pothole Detector PWA

A Progressive Web App for detecting and tracking potholes using computer vision and machine learning. Built with React, MediaPipe, and Supabase for cloud synchronization.

## Features

- Real-time pothole detection using device camera
- Machine learning-powered neural network for hazard identification
- Local storage and cloud synchronization with Supabase
- PWA capabilities for offline use and home screen installation
- Interactive radar display for sensor visualization
- Training mode to teach the AI new hazard patterns

## Tech Stack

- React 19
- TypeScript
- MediaPipe Vision API
- Supabase (for cloud sync)
- Tailwind CSS
- Vite with PWA plugin
- IndexedDB for local persistence

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/UmarMaaz/pot_hole_detector.git
   cd pot_hole_detector
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## PWA Capabilities

This app is built as a Progressive Web App with:

- Offline functionality
- Home screen installation
- Push notifications (coming soon)
- Responsive design for all devices
- Fast loading times with caching

## Architecture

- `App.tsx`: Main application component
- `components/CameraFeed.tsx`: Real-time camera feed with detection overlay
- `components/RadarDisplay.tsx`: Visual representation of sensor data
- `services/localModelService.ts`: ML model initialization and processing
- `services/supabaseClient.ts`: Cloud synchronization logic
- `types.ts`: Type definitions for the application

## Deployment

The app is built with Vite and can be deployed to any static hosting service like Netlify, Vercel, or GitHub Pages.
