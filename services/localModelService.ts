
import { HazardType, Detection } from "../types";
// @ts-ignore
import { ObjectDetector, ImageEmbedder, FilesetResolver } from "@mediapipe/tasks-vision";

let objectDetector: any = null;
let imageEmbedder: any = null;

const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);
};

export async function initLocalModel() {
  if (objectDetector && imageEmbedder) return { objectDetector, imageEmbedder };

  const delegate: "CPU" | "GPU" = isMobile() ? "CPU" : "GPU";
  console.log(`Initializing models with ${delegate} delegate...`);

  try {
    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );

  const createDetector = async (useDelegate: "CPU" | "GPU") => {
    return ObjectDetector.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
        delegate: useDelegate
      },
      scoreThreshold: 0.15, 
      runningMode: "VIDEO"
    });
  };

  const createEmbedder = async (useDelegate: "CPU" | "GPU") => {
    return ImageEmbedder.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite`,
        delegate: useDelegate
      },
      runningMode: "IMAGE"
    });
  };

    try {
      objectDetector = await createDetector(delegate);
    } catch (e) {
      console.warn("GPU detector failed, falling back to CPU:", e);
      objectDetector = await createDetector("CPU");
    }

    try {
      imageEmbedder = await createEmbedder(delegate);
    } catch (e) {
      console.warn("GPU embedder failed, falling back to CPU:", e);
      imageEmbedder = await createEmbedder("CPU");
    }

    return { objectDetector, imageEmbedder };
  } catch (error) {
    console.error("Local Model Initialization Failed:", error);
    throw error;
  }
}

export function computeCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  const denominator = Math.sqrt(mA) * Math.sqrt(mB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export function processDetections(results: any): Detection[] {
  if (!results || !results.detections) return [];

  return results.detections.map((det: any) => {
    const rawCategory = det.categories[0].categoryName.toLowerCase();
    const box = det.boundingBox;
    
    let type = HazardType.COLLISION_RISK;
    let label = rawCategory.toUpperCase();

    // Standard road objects
    if (rawCategory.includes('car') || rawCategory.includes('truck') || rawCategory.includes('bus') || rawCategory.includes('motorcycle')) {
        type = HazardType.VEHICLE;
        label = 'VEHICLE';
    } else if (rawCategory.includes('person')) {
        type = HazardType.PEDESTRIAN;
        label = 'PEDESTRIAN';
    } else {
        // Broadly classify everything else as a generic candidate for the neural engine
        type = HazardType.COLLISION_RISK;
        label = 'OBJECT';
    }

    // Normalize coordinates for 1280x720 video
    const normWidth = box.width / 1280;
    const estimatedDistance = Math.max(0.5, Math.min(30, 0.45 / (normWidth + 0.001)));

    return {
      id: `det-${Math.random().toString(36).substr(2, 4)}`,
      type: type,
      label: label,
      confidence: det.categories[0].score,
      bbox: [
        box.originY / 720, 
        box.originX / 1280, 
        (box.originY + box.height) / 720, 
        (box.originX + box.width) / 1280
      ],
      distance: estimatedDistance,
      timestamp: Date.now()
    };
  });
}
