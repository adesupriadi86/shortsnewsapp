
export type LayerType = 'text' | 'image' | 'video';

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  
  // Text specific
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bgColor?: string;
  bgTransparent?: boolean;
  padding?: number;
  outlineColor?: string;
  outlineWidth?: number;
  bold?: boolean;
  italic?: boolean;
  
  // Media specific
  element?: HTMLImageElement | HTMLVideoElement | null;
  src?: string; // For saving/loading
}

export interface BGConfig {
  x: number;
  y: number;
  scale: number;
  blur: number;
  type: 'image' | 'video' | 'none';
  src?: string;
}

export interface VFXState {
  type: string;
  color: string;
  opacity: number;
  size: number;
  speed: number;
  wind: number;
}

export interface OverlayState {
  type: 'none' | 'subscribe' | 'like' | 'follow';
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

export interface AudioConfig {
  musicVol: number;
  videoVol: number;
  layerVol: number;
  trim: number;
  totalDuration: number;
  src?: string;
}

export interface EditorState {
  layers: Layer[];
  selectedLayerId: string | null;
  bgConfig: BGConfig;
  vfxState: VFXState;
  overlayState: OverlayState;
  audioConfig: AudioConfig;
  limitDuration: number;
  videoMaxDuration: number;
  isPlaying: boolean;
  isRecording: boolean;
  
  // Batch Processing State
  batchVideos: File[];
  batchAudios: File[];
  newsQueue: NewsDraft[];
}

export interface Template {
    id: string;
    name: string;
    timestamp: number;
    bgConfig: BGConfig;
    vfxState: VFXState;
    overlayState?: OverlayState;
    limitDuration: number;
    audioConfig: AudioConfig;
    layers: Layer[];
}

// News Research Types
export interface NewsItem {
    id: string;
    title: string;
    description: string;
    source: string;
    imageUrl: string;
    category: string;
    publishedAt: string;
}

export interface NewsDraft {
    title: string;
    summary: string;
    imageUrl: string;
    source: string;
}
