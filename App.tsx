
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EditorState, Layer, Template, NewsDraft, LayerType, VFXState, OverlayState } from './types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, FONTS, COLOR_PALETTES, VFX_TYPES } from './constants';
import { LeftSidebar } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { EditorCanvas } from './components/EditorCanvas';
import { NewsWorkspace } from './components/NewsWorkspace';
import { LongVideoWorkspace } from './components/LongVideoWorkspace'; // NEW IMPORT
import { CameraRecorder } from './components/CameraRecorder';
import { AudioManager } from './utils/audioManager';
import { getCorsImageUrl } from './utils/proxyHelper';
import { getRandomStyle } from './utils/styleRandomizer';
import { Play, Pause, Download, Loader2, X, AlertCircle, ShieldCheck, Film, FileVideo, Share2, Layers, ExternalLink, Palette, Ban } from 'lucide-react';

const generateId = () => Math.random().toString(36).substring(2, 9);

const getInitialState = (): EditorState => ({
  layers: [],
  selectedLayerId: null,
  bgConfig: { x: 0, y: 0, scale: 1, blur: 0, type: 'none' },
  vfxState: { type: 'none', color: '#ffffff', opacity: 1, size: 1, speed: 1, wind: 0 },
  overlayState: { type: 'none', x: 0, y: 400, scale: 1, opacity: 1 },
  audioConfig: { musicVol: 0.5, videoVol: 1, layerVol: 1, trim: 0, totalDuration: 0 },
  limitDuration: 0,
  videoMaxDuration: 0,
  isPlaying: false,
  isRecording: false,
  batchVideos: [],
  batchAudios: [],
  newsQueue: []
});

// --- KONFIGURASI UTAMA ---
const LICENSE_API_URL = "https://script.google.com/macros/s/AKfycbxFO7yyC1ShDfaQtsr71gicoRwRhG7NFIN0ReYVmsSDoUi5F08uALUH-6AKdRw7a_qACw/exec"; 
// -------------------------

export default function App(): React.ReactElement {
  const [state, setState] = useState<EditorState>(getInitialState());
  const [uiResetKey, setUiResetKey] = useState(0);
  const [view, setView] = useState<'global' | 'layer' | 'templates' | 'ai'>('global');
  
  // BATCH UI STATE
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0); // Track preview index

  // RECORDING STATE
  const isRecordingCancelled = useRef(false);

  // LAZY INIT: Read storage immediately so data is never lost on refresh
  const [templates, setTemplates] = useState<Template[]>(() => {
    try {
      const saved = localStorage.getItem('shortsnews_templates');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load templates", e);
      return [];
    }
  });

  const [showNewsWorkspace, setShowNewsWorkspace] = useState(false);
  const [showLongVideoWorkspace, setShowLongVideoWorkspace] = useState(false); // NEW STATE
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCameraRecorder, setShowCameraRecorder] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'bg' | 'layer'>('layer');

  // LICENSE STATE (Locked by Default)
  const [isLocked, setIsLocked] = useState(true);
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseStatus, setLicenseStatus] = useState<'idle' | 'checking' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // SUCCESS MODAL STATE
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const bgImageRef = useRef<HTMLImageElement>(new Image());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // --- HELPER: DEVICE ID ---
  const getDeviceId = () => {
      let id = localStorage.getItem('toolalit_device_id');
      if (!id) {
          id = 'dev-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          localStorage.setItem('toolalit_device_id', id);
      }
      return id;
  };

  // --- HELPER: VALIDATE LICENSE ---
  const checkLicenseAPI = async (key: string) => {
      const deviceId = getDeviceId();
      try {
          const res = await fetch(`${LICENSE_API_URL}?key=${encodeURIComponent(key)}&deviceId=${encodeURIComponent(deviceId)}`);
          const data = await res.json();
          return data; 
      } catch (e) {
          return { status: 'error', message: 'Gagal terhubung ke server lisensi.' };
      }
  };

  useEffect(() => {
      const initAuth = async () => {
          const params = new URLSearchParams(window.location.search);
          const urlKey = params.get('key');
          const savedKey = localStorage.getItem('toolalit_license_key');
          const keyToValidate = urlKey || savedKey;

          if (keyToValidate) {
              setIsLocked(false); 
              if (urlKey) {
                  localStorage.setItem('toolalit_license_key', urlKey);
                  try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) { }
              }
              const result = await checkLicenseAPI(keyToValidate);
              if (result.status === 'blocked' || result.status === 'error') {
                  if (result.status === 'blocked' || (result.message && result.message.includes('Tidak Ditemukan'))) {
                      setIsLocked(true);
                      localStorage.removeItem('toolalit_license_key'); 
                      setStatusMessage(result.message);
                  }
              }
          }
      };
      initAuth();
  }, []);

  const handleManualUnlock = async (e: React.FormEvent) => {
      e.preventDefault();
      setLicenseStatus('checking');
      setStatusMessage('');
      const result = await checkLicenseAPI(licenseInput);
      if (result.status === 'success') {
          localStorage.setItem('toolalit_license_key', licenseInput);
          setIsLocked(false);
      } else {
          setStatusMessage(result.message || 'Key tidak valid');
      }
      setLicenseStatus('idle');
  };

  // --- INIT AUDIO & VIDEO ---
  useEffect(() => {
    audioManagerRef.current = new AudioManager();
    return () => { audioManagerRef.current?.close(); };
  }, []);

  useEffect(() => {
    audioManagerRef.current?.setVolumes(
      state.audioConfig.videoVol,
      state.audioConfig.musicVol,
      state.audioConfig.layerVol ?? 1
    );
  }, [state.audioConfig]);

  useEffect(() => {
    const vid = videoRef.current;
    vid.crossOrigin = "anonymous";
    vid.loop = true;
    vid.muted = false; 
    vid.volume = 1.0;
  }, [state.bgConfig.type]);

  useEffect(() => {
    const vid = videoRef.current;
    if (state.isPlaying || state.isRecording) {
      audioManagerRef.current?.resume();
      vid.play().catch(() => {});
      
      if (state.audioConfig.src && state.audioConfig.totalDuration > 0) {
        const offset = state.audioConfig.trim;
        let duration = state.limitDuration > 0 ? state.limitDuration : (state.videoMaxDuration || state.audioConfig.totalDuration);
        if (duration <= 0) duration = 30;
        audioManagerRef.current?.playMusic(offset, duration);
      }

      state.layers.forEach(l => {
        if (l.type === 'video' && l.element instanceof HTMLVideoElement) {
          l.element.currentTime = 0;
          l.element.muted = false;
          l.element.volume = 1.0;
          l.element.play().catch(() => {});
          audioManagerRef.current?.connectLayer(l.element);
        }
      });
    } else {
      vid.pause();
      audioManagerRef.current?.stopMusic();
      state.layers.forEach(l => {
        if (l.type === 'video' && l.element instanceof HTMLVideoElement) {
          l.element.pause();
        }
      });
    }
  }, [state.isPlaying, state.isRecording]);

  const handleUpdateGlobal = (updates: any) => setState(prev => ({ ...prev, ...updates }));
  const handleUpdateVFX = (updates: Partial<VFXState>) => setState(prev => ({ ...prev, vfxState: { ...prev.vfxState, ...updates } }));
  const handleUpdateOverlay = (updates: Partial<OverlayState>) => setState(prev => ({ ...prev, overlayState: { ...prev.overlayState, ...updates } }));

  const handleAddLayer = async (type: LayerType, file?: File) => {
    const id = generateId();
    let newItem: Layer = {
      id, type, name: `${type} ${state.layers.length + 1}`,
      x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, width: 300, height: 100, scale: 1, rotation: 0
    };

    if (type === 'text') {
      // DEFAULT TEXT COLOR: Black Text on Yellow BG (Bright Style)
      newItem = { ...newItem, content: 'Double Click to Edit', fontFamily: 'Arial', fontSize: 50, color: '#000000', bgColor: '#ffff00', bgTransparent: false, padding: 20, bold: true };
      setState(prev => ({ ...prev, layers: [...prev.layers, newItem], selectedLayerId: id }));
      setView('layer');
    } else if (file) {
      const url = URL.createObjectURL(file);
      newItem.src = url;
      if (type === 'image') {
        const img = new Image();
        img.src = url;
        await new Promise(r => img.onload = r);
        newItem.element = img;
        newItem.width = img.width;
        newItem.height = img.height;
        if (img.width > CANVAS_WIDTH * 0.5) newItem.scale = (CANVAS_WIDTH * 0.5) / img.width;
        setState(prev => ({ ...prev, layers: [...prev.layers, newItem], selectedLayerId: id }));
        setView('layer');
      } else if (type === 'video') {
        const v = document.createElement('video');
        v.src = url;
        v.crossOrigin = "anonymous";
        v.loop = true;
        v.muted = false; v.volume = 1.0; 
        v.onseeked = () => { setState(prev => ({ ...prev })); };
        await new Promise(r => v.onloadedmetadata = r);
        v.currentTime = 0.01;
        newItem.element = v;
        newItem.width = v.videoWidth;
        newItem.height = v.videoHeight;
        if (v.videoWidth > CANVAS_WIDTH * 0.5) newItem.scale = (CANVAS_WIDTH * 0.5) / v.videoWidth;
        audioManagerRef.current?.connectLayer(v);
        setState(prev => ({ ...prev, layers: [...prev.layers, newItem], selectedLayerId: id }));
        setView('layer');
      }
    }
  };

  const openCamera = (target: 'bg' | 'layer') => {
      setCameraTarget(target);
      setShowCameraRecorder(true);
  };

  const handleCameraSave = (file: File) => {
      if (cameraTarget === 'bg') {
          handleBgUpload(file);
      } else {
          handleAddLayer('video', file);
      }
      setShowCameraRecorder(false);
  };

  const handleUpdateLayer = (id: string, updates: any) => {
    setState(prev => ({ ...prev, layers: prev.layers.map(l => l.id === id ? { ...l, ...updates } : l) }));
  };

  const handleDeleteLayer = (id: string) => {
    setState(prev => ({ ...prev, layers: prev.layers.filter(l => l.id !== id), selectedLayerId: null }));
    setView('global');
  };

  const handleReset = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = () => {
      if (state.isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
      if (audioManagerRef.current) {
          audioManagerRef.current.stopMusic();
          try { audioManagerRef.current.reset(); } catch(e) {}
          audioManagerRef.current.setVolumes(1.0, 0.5, 1.0);
      }
      if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
      }
      if (bgImageRef.current) {
          bgImageRef.current.removeAttribute('src');
      }
      state.layers.forEach(layer => {
          if (layer.type === 'video' && layer.element instanceof HTMLVideoElement) {
              try { layer.element.pause(); layer.element.removeAttribute('src'); layer.element.load(); } catch(e) {}
          }
      });

      setShowCameraRecorder(false);
      setView('global');
      setShowNewsWorkspace(false);
      setShowLongVideoWorkspace(false);
      setShowSuccessModal(false);
      setShowClearConfirm(false); 
      
      setState(getInitialState());
      setCurrentBatchIndex(0);
      setUiResetKey(prev => prev + 1);
  };

  const handleBgUpload = (file: File): Promise<void> => {
      return new Promise((resolve) => {
          if (!videoRef.current || !bgImageRef.current) { resolve(); return; }
          const url = URL.createObjectURL(file);
          const isVideo = file.type.startsWith('video');
          
          if (isVideo) {
              const vid = videoRef.current;
              vid.onloadedmetadata = null;
              vid.onerror = null;
              vid.onseeked = null;
              vid.src = url;
              vid.muted = false; 
              vid.volume = 1.0;
              vid.onseeked = () => { setState(prev => ({ ...prev })); };
              vid.onloadedmetadata = () => {
                 let scale = 1;
                 if (vid.videoWidth > 0 && vid.videoHeight > 0) {
                     const vidRatio = vid.videoWidth / vid.videoHeight;
                     const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
                     if (vidRatio > canvasRatio) { scale = CANVAS_HEIGHT / vid.videoHeight; } else { scale = CANVAS_WIDTH / vid.videoWidth; }
                     scale = scale * 1.02;
                 }
                 setState(prev => ({ 
                      ...prev, 
                      videoMaxDuration: vid.duration || 0,
                      bgConfig: { ...prev.bgConfig, type: 'video', scale, x: 0, y: 0, src: url }
                 }));
                 audioManagerRef.current?.connectVideo(vid);
                 vid.currentTime = 0.001;
                 resolve();
              };
              vid.load();
          } else {
              const img = bgImageRef.current;
              img.src = url;
              img.onload = () => {
                  const s = (img.width / img.height > CANVAS_WIDTH / CANVAS_HEIGHT) ? CANVAS_HEIGHT / img.height : CANVAS_WIDTH / img.width;
                  setState(prev => ({ 
                      ...prev, 
                      bgConfig: { ...prev.bgConfig, type: 'image', scale: s, x: 0, y: 0, src: url }, 
                      videoMaxDuration: 0 
                  }));
                  resolve();
              };
          }
      });
  };

  const handleBatchBgUpload = async (files: File[]) => {
      const renamedFiles = files.map((f, i) => new File([f], `${i+1}_${f.name}`, { type: f.type }));
      setState(prev => ({ ...prev, batchVideos: renamedFiles }));
      
      // Automatically load the first video
      if (renamedFiles.length > 0) {
          await handleBgUpload(renamedFiles[0]);
      }
  };
  
  // NEW: Handle applying long video files (simulated split or just add to batch)
  const handleLongVideoApply = async (files: File[]) => {
      setShowLongVideoWorkspace(false);
      // For now, we treat them as batch uploads (Appends to existing batch if any)
      const currentBatch = state.batchVideos;
      const startIdx = currentBatch.length;
      const renamedFiles = files.map((f, i) => new File([f], `LONG_${startIdx+i+1}_${f.name}`, { type: f.type }));
      
      const newBatch = [...currentBatch, ...renamedFiles];
      setState(prev => ({ ...prev, batchVideos: newBatch }));
      
      // Load first if batch was empty
      if (currentBatch.length === 0 && renamedFiles.length > 0) {
          await handleBgUpload(renamedFiles[0]);
      }
  };

  const handleAudioUpload = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    try {
        const duration = await audioManagerRef.current?.loadMusic(arrayBuffer) || 0;
        setState(prev => ({ ...prev, audioConfig: { ...prev.audioConfig, totalDuration: duration, src: URL.createObjectURL(file) } }));
    } catch (e: any) { alert(e.message); }
  };

  const handleBatchAudioUpload = async (files: File[]) => {
      setState(prev => ({ ...prev, batchAudios: files }));
      if (files.length > 0) {
          handleAudioUpload(files[0]);
      }
  };

  const handleAIImageGenerated = async (url: string, type: 'background' | 'overlay') => {
    const safeUrl = getCorsImageUrl(url); 
    if (type === 'background') {
      setState(prev => ({ ...prev, bgConfig: { ...prev.bgConfig, type: 'image', src: safeUrl } }));
      bgImageRef.current.src = safeUrl;
    } else {
      const id = generateId();
      const img = new Image();
      img.src = safeUrl;
      img.crossOrigin = "anonymous";
      await new Promise(r => img.onload = r);
      const newItem: Layer = {
        id, type: 'image', name: 'AI Image',
        x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, width: img.width, height: img.height,
        scale: (CANVAS_WIDTH * 0.6) / img.width, rotation: 0,
        element: img, src: safeUrl
      };
      setState(prev => ({ ...prev, layers: [...prev.layers, newItem], selectedLayerId: id }));
      setView('layer');
    }
  };

  const handleApplyNews = async (drafts: NewsDraft[]) => {
    setShowNewsWorkspace(false);
    
    setState(prev => ({ ...prev, newsQueue: drafts }));
    setCurrentBatchIndex(0); // Reset Index on new batch
    
    // Apply the first item to the canvas for preview/editing (No randomization for manual preview)
    if (drafts.length > 0) {
        applyDraftToCanvas(drafts[0], false);
    }
  };

  // --- MANUAL STYLE RANDOMIZATION ---
  const handleRandomizeStyle = () => {
    // Generate distinct styles for Headline and Summary
    const styleHeadline = getRandomStyle();
    const styleSummary = getRandomStyle();

    setState(prev => ({
        ...prev,
        layers: prev.layers.map(l => {
            if (l.type !== 'text') return l;
            
            // Apply randomized style to Headline
            if (l.name === 'Headline') {
                return { 
                    ...l, 
                    fontFamily: styleHeadline.fontFamily,
                    color: styleHeadline.color,
                    bgColor: styleHeadline.bgColor,
                    bgTransparent: false,
                    bold: true // Keep bold preference for headline
                };
            }
            // Apply randomized style to Summary
            if (l.name === 'Summary') {
                return { 
                    ...l, 
                    fontFamily: styleSummary.fontFamily,
                    color: styleSummary.color,
                    bgColor: styleSummary.bgColor,
                    bgTransparent: false,
                };
            }
            return l;
        })
    }));
  };

  // --- BATCH PREVIEW NAVIGATION ---
  const handleBatchPreview = async (direction: 'next' | 'prev') => {
      const queue = state.newsQueue;
      if (!queue || queue.length === 0) return;

      let newIndex = direction === 'next' ? currentBatchIndex + 1 : currentBatchIndex - 1;
      if (newIndex >= queue.length) newIndex = 0;
      if (newIndex < 0) newIndex = queue.length - 1;

      setCurrentBatchIndex(newIndex);

      // 1. Load News
      const item = queue[newIndex];
      // When navigating manually in batch preview, randomize if index > 0 to match batch behavior, or always randomize
      applyDraftToCanvas(item, newIndex > 0); 

      // 2. Load BG if available
      if (state.batchVideos.length > 0) {
          const bgFile = state.batchVideos[newIndex % state.batchVideos.length];
          await handleBgUpload(bgFile);
      }

      // 3. Load Audio if available
      if (state.batchAudios.length > 0) {
          const audioFile = state.batchAudios[newIndex % state.batchAudios.length];
          await handleAudioUpload(audioFile);
      }
  };

  const applyDraftToCanvas = (draft: NewsDraft, randomize: boolean = false) => {
    // --- RANDOMIZATION PREP ---
    let hFont = 'Arial', hColor = '#000000', hBg = '#ffff00'; // DEFAULT: Black on Yellow (High Vis)
    let sFont = 'Roboto', sColor = '#000000', sBg = '#ffffff'; // DEFAULT: Black on White
    
    if (randomize) {
        const hStyle = getRandomStyle();
        const sStyle = getRandomStyle();
        
        hFont = hStyle.fontFamily;
        hColor = hStyle.color;
        hBg = hStyle.bgColor;
        
        sFont = sStyle.fontFamily;
        sColor = sStyle.color;
        sBg = sStyle.bgColor;
    }

    // --- CONFIGURATION (STRICT VERTICAL STACK) ---
    const GAP = 10;          
    const MARGIN_X = 40;     
    const TEXT_WIDTH = CANVAS_WIDTH - (MARGIN_X * 2);

    // 1. IMAGE CONFIG (ANCHOR)
    const IMAGE_CENTER_Y = 300; 
    const MAX_IMAGE_H = 450; 

    // 2. TEXT LAYER HEIGHTS (FIXED AS REQUESTED)
    const HEADLINE_H = 100; // Fixed 100px (3 lines)
    const SUMMARY_H = 200;  // Fixed 300px (4-5 lines)
    const SOURCE_H = 30;

    const safeImageUrl = getCorsImageUrl(draft.imageUrl);

    // --- SNAPSHOT EXISTING LAYOUT FOR PERSISTENCE ---
    // We check current layers to preserve user adjustments (x, y, scale, size)
    const existingHeadline = state.layers.find(l => l.name === 'Headline');
    const existingSummary = state.layers.find(l => l.name === 'Summary');
    const existingSource = state.layers.find(l => l.name === 'Source');
    const existingMedia = state.layers.find(l => l.name === 'News Media');
    
    const pushLayers = (imageLayer: Layer | null, actualImageHeight: number) => {
        const layersToAdd: Layer[] = [];
        
        // A. Add Image (If exists)
        if (imageLayer) {
             // If media existed before, copy its Transform (X, Y, Scale, Rotation)
             if (existingMedia) {
                 imageLayer.x = existingMedia.x;
                 imageLayer.y = existingMedia.y;
                 imageLayer.scale = existingMedia.scale;
                 imageLayer.rotation = existingMedia.rotation;
                 // Note: We deliberately do NOT copy Width/Height exactly because new images might have different aspect ratios.
                 // We let the new image setup determine the bounding box based on width constraint, but keep the position/scale anchor.
             }
             layersToAdd.push(imageLayer);
        }

        // --- CALCULATE FALLBACK POSITIONS (CASCADE DOWN) ---
        // These are used ONLY if the layer doesn't exist yet.
        const imgBottomEdge = IMAGE_CENTER_Y + (actualImageHeight / 2);
        const headlineTop = imgBottomEdge + GAP;
        const headlineCenterY = headlineTop + (HEADLINE_H / 2);
        const headlineBottom = headlineTop + HEADLINE_H;
        const summaryTop = headlineBottom + GAP;
        const summaryCenterY = summaryTop + (SUMMARY_H / 2);
        const summaryBottom = summaryTop + SUMMARY_H;
        const sourceTop = summaryBottom + GAP;
        const sourceCenterY = sourceTop + (SOURCE_H / 2);

        // B. Headline
        const titleId = existingHeadline ? existingHeadline.id : generateId();
        const baseHeadline: Layer = {
          id: titleId, type: 'text', name: 'Headline', 
          x: existingHeadline ? existingHeadline.x : CANVAS_WIDTH / 2, 
          y: existingHeadline ? existingHeadline.y : headlineCenterY, 
          width: existingHeadline ? existingHeadline.width : TEXT_WIDTH, 
          height: existingHeadline ? existingHeadline.height : HEADLINE_H, 
          scale: existingHeadline ? existingHeadline.scale : 1, 
          rotation: existingHeadline ? existingHeadline.rotation : 0, 
          // Content & Style is always updated/randomized
          content: draft.title, 
          fontFamily: hFont, fontSize: 28, 
          color: hColor, bgColor: hBg, 
          bgTransparent: false, padding: 10, 
          bold: true, outlineWidth: 0
        };
        layersToAdd.push(baseHeadline);

        // C. Summary
        const bodyId = existingSummary ? existingSummary.id : generateId();
        const baseSummary: Layer = {
          id: bodyId, type: 'text', name: 'Summary', 
          x: existingSummary ? existingSummary.x : CANVAS_WIDTH / 2, 
          y: existingSummary ? existingSummary.y : summaryCenterY, 
          width: existingSummary ? existingSummary.width : TEXT_WIDTH, 
          height: existingSummary ? existingSummary.height : SUMMARY_H, 
          scale: existingSummary ? existingSummary.scale : 1, 
          rotation: existingSummary ? existingSummary.rotation : 0, 
          // Content & Style is always updated/randomized
          content: draft.summary, 
          fontFamily: sFont, fontSize: 26, 
          color: sColor, bgColor: sBg, 
          bgTransparent: false, padding: 20, 
          bold: false
        };
        layersToAdd.push(baseSummary);

        // D. Source
        const sourceId = existingSource ? existingSource.id : generateId();
        const baseSource: Layer = {
          id: sourceId, type: 'text', name: 'Source', 
          x: existingSource ? existingSource.x : CANVAS_WIDTH / 2, 
          y: existingSource ? existingSource.y : sourceCenterY, 
          width: existingSource ? existingSource.width : 500, 
          height: existingSource ? existingSource.height : SOURCE_H, 
          scale: existingSource ? existingSource.scale : 1, 
          rotation: existingSource ? existingSource.rotation : 0, 
          content: `SOURCE: ${draft.source}`, 
          fontFamily: 'Roboto', fontSize: 24, 
          color: '#aaaaaa', bgColor: 'transparent', 
          bgTransparent: true, padding: 5, 
          bold: true, italic: true
        };
        layersToAdd.push(baseSource);

        setState(prev => {
            // Remove old template layers so we don't duplicate ID clashes or stale layers
            const filtered = prev.layers.filter(l => !['Headline', 'Summary', 'Source', 'News Media'].includes(l.name));
            return { ...prev, layers: [...filtered, ...layersToAdd] };
        });
    };

    // 0. Load Image to get Dimensions first
    const img = new Image();
    img.src = safeImageUrl;
    img.crossOrigin = "anonymous";
    img.onload = () => {
        // Calculate fit dimensions
        let w = img.width;
        let h = img.height;
        
        // Scale down if too big (Keep Aspect Ratio)
        // Constrain by Width (Max 80% canvas) OR Height (MAX_IMAGE_H)
        const maxWidth = CANVAS_WIDTH * 0.9;
        
        const ratio = w / h;
        
        // 1. Check Width
        if (w > maxWidth) {
            w = maxWidth;
            h = w / ratio;
        }
        
        // 2. Check Height (after width adjustment)
        if (h > MAX_IMAGE_H) {
            h = MAX_IMAGE_H;
            w = h * ratio;
        }

        const imageLayer: Layer = {
            id: generateId(),
            type: 'image',
            name: 'News Media',
            x: CANVAS_WIDTH / 2,
            y: IMAGE_CENTER_Y, // Anchor Center
            width: w,
            height: h,
            scale: 1,
            rotation: 0,
            element: img,
            src: safeImageUrl
        };
        
        pushLayers(imageLayer, h);
    };

    img.onerror = () => {
        // Fallback if image fails: Push text only, assuming 0 height image
        pushLayers(null, 0);
    };
  };

    const downloadBlob = async (blob: Blob, name: string) => {
    if (navigator.canShare) {
        const file = new File([blob], name, { type: 'video/webm' });
        if (navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: 'ShortsNews Video' }); return; } catch (err) {}
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // --- RECORDING ---
  const performRecording = (filename: string): Promise<Blob | null> => {
      return new Promise((resolve, reject) => {
          (async () => {
              if (!canvasRef.current || !audioManagerRef.current) { reject('No canvas'); return; }
              
              if (state.isPlaying) setState(s => ({ ...s, isPlaying: false }));
              isRecordingCancelled.current = false;
              
              if (videoRef.current) videoRef.current.currentTime = 0;
              audioManagerRef.current.resetMusicTime();
              audioManagerRef.current.resume();

              setState(s => ({ ...s, isRecording: true }));

              try {
                  const canvasStream = canvasRef.current.captureStream(30);
                  const audioStream = audioManagerRef.current.getStream();
                  const combinedStream = new MediaStream([
                      ...canvasStream.getVideoTracks(),
                      ...audioStream.getAudioTracks()
                  ]);
                  
                  const recorder = new MediaRecorder(combinedStream, { 
                      mimeType: 'video/webm;codecs=vp9,opus', 
                      videoBitsPerSecond: 5000000 
                  });
                  
                  const chunks: Blob[] = [];
                  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
                  recorder.onstop = () => {
                      setState(s => ({ ...s, isRecording: false }));
                      if (isRecordingCancelled.current) { resolve(null); return; }
                      const blob = new Blob(chunks, { type: 'video/webm' });
                      downloadBlob(blob, filename);
                      resolve(blob);
                  };

                  recorder.start();
                  mediaRecorderRef.current = recorder;

                  if (videoRef.current) videoRef.current.play().catch(()=>{});
                  const duration = state.limitDuration > 0 ? state.limitDuration : 9999;
                  audioManagerRef.current.playMusic(state.audioConfig.trim, duration, false);
                  
                  state.layers.forEach(l => { 
                      if (l.type === 'video' && l.element instanceof HTMLVideoElement) {
                          l.element.currentTime = 0;
                          l.element.play().catch(()=>{});
                      }
                  });

                  const stopTime = (state.limitDuration > 0 ? state.limitDuration : (state.videoMaxDuration || 10)) * 1000;
                  setTimeout(() => {
                      if (recorder.state !== 'inactive') recorder.stop();
                  }, stopTime + 500);

              } catch (e) {
                  setState(s => ({ ...s, isRecording: false }));
                  reject(e);
              }
          })();
      });
  };

  const cancelRecording = () => {
      isRecordingCancelled.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
      if (audioManagerRef.current) audioManagerRef.current.stopMusic();
      if (videoRef.current) videoRef.current.pause();
      state.layers.forEach(l => {
          if (l.type === 'video' && l.element instanceof HTMLVideoElement) {
              l.element.pause();
          }
      });
      setState(s => ({ ...s, isRecording: false, isPlaying: false }));
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
  };

  // --- BATCH ENGINE ---
  const runBatchProcessing = async () => {
      const { newsQueue, batchVideos, batchAudios } = state;
      if (newsQueue.length === 0) return;
      
      setIsBatchProcessing(true);
      setBatchProgress({ current: 0, total: newsQueue.length });
      isRecordingCancelled.current = false;

      const originalVfxType = state.vfxState.type;

      for (let i = 0; i < newsQueue.length; i++) {
          if (isRecordingCancelled.current) break;

          setBatchProgress({ current: i + 1, total: newsQueue.length });
          const newsItem = newsQueue[i];

          if (originalVfxType !== 'none') {
             const activeVfx = VFX_TYPES.filter(v => v.value !== 'none');
             const randomVfx = activeVfx[Math.floor(Math.random() * activeVfx.length)].value;
             setState(prev => ({ ...prev, vfxState: { ...prev.vfxState, type: randomVfx } }));
          }

          applyDraftToCanvas(newsItem, true);

          if (batchVideos.length > 0) {
              const bgFile = batchVideos[i % batchVideos.length];
              await handleBgUpload(bgFile);
          }

          if (batchAudios.length > 0) {
              const audioFile = batchAudios[i % batchAudios.length];
              await handleAudioUpload(audioFile);
          }

          await new Promise(r => setTimeout(r, 2000));

          const safeTitle = newsItem.title.substring(0, 150).replace(/[^a-z0-9]/gi, '_');
          const filename = `${safeTitle}.webm`;

          try {
              const blob = await performRecording(filename);
              if (!blob) break; 
          } catch (e) { console.error("Batch recording error:", e); }

          await new Promise(r => setTimeout(r, 1000));
      }

      setIsBatchProcessing(false);
      if (!isRecordingCancelled.current) {
          setShowSuccessModal(true);
      }
  };

  // --- RENDER ---
  if (isLocked) {
      return (
          <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white font-sans">
              <div className="w-full max-w-md p-8 bg-[#181818] rounded-xl border border-[#2a2a2a] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-red-500"></div>
                  <h1 className="text-3xl font-bold text-center mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">SHORTNEWS PRO</h1>
                  <p className="text-center text-gray-500 mb-8 text-xs uppercase tracking-widest">Premium Video Creator</p>
                  
                  <form onSubmit={handleManualUnlock} className="space-y-4">
                      <div className="relative">
                          <input 
                            type="text" 
                            value={licenseInput}
                            onChange={e => setLicenseInput(e.target.value)}
                            className="w-full bg-[#0f0f0f] border border-[#333] p-4 rounded-lg text-center font-mono tracking-[0.2em] text-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase text-white placeholder-gray-700 transition-all"
                            placeholder="XXXX-XXXX-XXXX"
                          />
                          <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
                      </div>
                      <button 
                        type="submit" 
                        disabled={licenseStatus === 'checking' || !licenseInput}
                        className="w-full bg-white hover:bg-gray-200 text-black font-bold py-4 rounded-lg transition disabled:opacity-50 flex justify-center items-center gap-2"
                      >
                        {licenseStatus === 'checking' ? <Loader2 className="animate-spin" /> : 'AKTIFKAN LISENSI'}
                      </button>
                  </form>
                  {statusMessage && (
                      <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs text-center font-medium animate-in fade-in slide-in-from-top-2">
                          {statusMessage}
                      </div>
                  )}
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black text-white font-sans overflow-hidden">
      <LeftSidebar
        key={'left-' + uiResetKey}
        state={state}
        onAddLayer={handleAddLayer}
        onBgUpload={handleBgUpload}
        onBatchBgUpload={handleBatchBgUpload}
        onAudioUpload={handleAudioUpload}
        onBatchAudioUpload={handleBatchAudioUpload}
        onClearBg={() => { setState(s => ({ ...s, bgConfig: { ...s.bgConfig, type: 'none', src: undefined } })); videoRef.current.pause(); videoRef.current.src = ""; setState(prev => ({...prev, batchVideos: []})); }}
        onClearAudio={() => { audioManagerRef.current?.reset(); setState(s => ({ ...s, audioConfig: { ...s.audioConfig, totalDuration: 0, src: undefined } })); setState(prev => ({...prev, batchAudios: []})); }}
        onSelectLayer={(id) => { setState(s => ({ ...s, selectedLayerId: id })); if(id) setView('layer'); }}
        onDeleteLayer={handleDeleteLayer}
        onTrimAudio={(val) => setState(s => ({ ...s, audioConfig: { ...s.audioConfig, trim: val } }))}
        onOpenTemplates={() => setView('templates')}
        onSaveTemplate={(name) => {
          const newTpl: Template = { id: generateId(), name, timestamp: Date.now(), bgConfig: state.bgConfig, vfxState: state.vfxState, overlayState: state.overlayState, limitDuration: state.limitDuration, audioConfig: state.audioConfig, layers: state.layers };
          const updated = [...templates, newTpl];
          setTemplates(updated);
          localStorage.setItem('shortsnews_templates', JSON.stringify(updated));
        }}
        onOpenAI={() => setView('ai')}
        onOpenNews={() => setShowNewsWorkspace(true)}
        onOpenLongVideo={() => setShowLongVideoWorkspace(true)} // Wire up the new handler
        onAddCamera={() => openCamera('layer')}
        onAddBgCamera={() => openCamera('bg')}
        onReset={handleReset}
        audioDuration={state.audioConfig.totalDuration}
      />
      
      <div className="flex-1 flex flex-col relative bg-[#0a0a0a]">
        <div className="h-14 bg-[#121212] border-b border-[#2a2a2a] flex items-center justify-center px-4 z-10 shadow-lg">
          <div className="flex items-center gap-3">
            <button onClick={() => { 
                if (state.isRecording) {
                    stopRecording(); 
                } else if (state.isPlaying) {
                    setState(s => ({ ...s, isPlaying: false })); 
                } else { 
                    if (videoRef.current) videoRef.current.currentTime = 0;
                    audioManagerRef.current?.resetMusicTime();
                    audioManagerRef.current?.resume(); 
                    setState(s => ({ ...s, isPlaying: true })); 
                } 
              }}
              disabled={isBatchProcessing && !state.isRecording}
              className={`flex items-center gap-2 px-5 py-2 rounded font-bold text-xs transition border ${state.isRecording ? 'bg-red-600 border-red-500 animate-pulse text-white' : state.isPlaying ? 'bg-yellow-600 border-yellow-500 text-white' : 'bg-[#1a1a1a] border-green-600 text-green-500 hover:bg-green-900/20'}`}>
              {state.isRecording ? '● STOP & SAVE' : state.isPlaying ? <><Pause size={12} /> PAUSE</> : <><Play size={12} /> PREVIEW</>}
            </button>
            
            {state.isRecording && (
                <button 
                    onClick={cancelRecording}
                    className="flex items-center gap-2 px-5 py-2 rounded font-bold text-xs transition bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600 animate-in fade-in"
                >
                    <Ban size={12} /> BATAL
                </button>
            )}

            {state.newsQueue.length > 0 && !isBatchProcessing && !state.isRecording && (
                <>
                    <button 
                        onClick={runBatchProcessing}
                        className="flex items-center gap-2 px-5 py-2 rounded font-bold text-xs transition bg-purple-600 hover:bg-purple-500 text-white animate-in zoom-in"
                    >
                       <Layers size={14} /> ⚡ PROCESS BATCH ({state.newsQueue.length})
                    </button>
                    
                    <button 
                        onClick={handleRandomizeStyle}
                        className="flex items-center gap-2 px-3 py-2 rounded font-bold text-xs transition bg-[#1a1a1a] border border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                        title="Randomize Text Styles"
                    >
                       <Palette size={14} /> 
                       <span className="hidden md:inline">STYLE</span>
                    </button>
                </>
            )}

            {isBatchProcessing && (
                <div className="flex items-center gap-2 px-5 py-2 rounded font-bold text-xs bg-gray-800 text-white border border-gray-600">
                    <Loader2 size={12} className="animate-spin" />
                    Processing {batchProgress.current}/{batchProgress.total}
                </div>
            )}
          </div>
        </div>
        <EditorCanvas
          key={'canvas-' + uiResetKey}
          state={state}
          videoRef={videoRef}
          bgImageRef={bgImageRef}
          canvasRef={canvasRef}
          onSelectLayer={(id) => { setState(s => ({ ...s, selectedLayerId: id })); if (id) setView('layer'); }}
          onUpdateLayerPos={(id, x, y) => setState(prev => ({ ...prev, layers: prev.layers.map(l => l.id === id ? { ...l, x, y } : l) }))}
          onUpdateBgPos={(x, y) => setState(s => ({ ...s, bgConfig: { ...s.bgConfig, x, y } }))}
          onAutoStop={() => { if (state.isRecording) stopRecording(); else setState(s => ({ ...s, isPlaying: false })); }}
          onPrevPreview={() => handleBatchPreview('prev')}
          onNextPreview={() => handleBatchPreview('next')}
          batchIndex={currentBatchIndex}
          batchTotal={state.newsQueue.length}
        />
      </div>

      <RightSidebar
        key={'right-' + uiResetKey}
        state={state}
        view={view}
        setView={setView}
        templates={templates}
        onUpdateLayer={handleUpdateLayer}
        onUpdateGlobal={handleUpdateGlobal}
        onUpdateVFX={handleUpdateVFX}
        onUpdateOverlay={handleUpdateOverlay}
        onLoadTemplate={(t) => { setState(prev => ({ ...prev, bgConfig: t.bgConfig, vfxState: t.vfxState, overlayState: t.overlayState || { type: 'none', x: 0, y: 400, scale: 1, opacity: 1 }, audioConfig: t.audioConfig, limitDuration: t.limitDuration, layers: t.layers.map(l => ({ ...l, element: undefined })) })); t.layers.forEach(async l => { if (l.src && l.type === 'image') { const img = new Image(); img.src = l.src; await new Promise(r => img.onload = r); setState(prev => ({ ...prev, layers: prev.layers.map(px => px.id === l.id ? { ...px, element: img } : px) })); } }); }}
        onDeleteTemplate={(id) => { const updated = templates.filter(t => t.id !== id); setTemplates(updated); localStorage.setItem('shortsnews_templates', JSON.stringify(updated)); }}
        onDeleteLayer={handleDeleteLayer}
        onAIImageGenerated={handleAIImageGenerated}
      />
      
      {showNewsWorkspace && (
          <NewsWorkspace 
              onClose={() => setShowNewsWorkspace(false)} 
              onApply={handleApplyNews}
              maxSelection={state.batchVideos.length} 
          />
      )}
      
      {showLongVideoWorkspace && (
          <LongVideoWorkspace 
             onClose={() => setShowLongVideoWorkspace(false)} 
             onApply={handleLongVideoApply} 
          />
      )}
      
      {showCameraRecorder && (
          <CameraRecorder 
             onClose={() => setShowCameraRecorder(false)} 
             onSave={handleCameraSave} 
          />
      )}

      {showClearConfirm && (
        <div className="absolute inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#181818] border border-gray-700 p-6 rounded-lg shadow-2xl max-w-sm w-full text-center animate-in zoom-in-95">
                <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Reset Project?</h3>
                <p className="text-sm text-gray-400 mb-6">
                    Semua layer, audio, dan pengaturan akan dihapus. <br/>Tindakan ini tidak bisa dibatalkan.
                </p>
                <div className="flex justify-center gap-3">
                    <button 
                        onClick={() => setShowClearConfirm(false)} 
                        className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold"
                    >
                        Batal
                    </button>
                    <button 
                        onClick={confirmClearAll} 
                        className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg"
                    >
                        Ya, Hapus Semua
                    </button>
                </div>
            </div>
        </div>
      )}

      {showSuccessModal && (
            <div className="absolute inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
                <div className="bg-[#181818] border border-gray-600 p-8 rounded-xl text-center max-w-md shadow-2xl animate-in zoom-in-95 relative">
                    <div className="mb-4 flex justify-center">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                            <ShieldCheck size={32} className="text-green-500" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Berhasil Disimpan!</h2>
                    <p className="text-gray-400 mb-6 text-sm">
                        {isBatchProcessing || batchProgress.total > 0 
                           ? `Batch Processing Selesai! ${batchProgress.total} video telah dibuat.` 
                           : "Video WebM telah disimpan ke perangkat Anda."}
                        <br/>Gunakan converter online berikut untuk format MP4:
                    </p>
                    
                    <div className="flex flex-col gap-2 mb-6">
                        <a 
                            href="https://convertio.co/id/" 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-full px-4 py-3 rounded-lg bg-[#252525] hover:bg-[#333] border border-gray-700 text-blue-400 font-medium text-sm transition flex items-center justify-between group"
                        >
                            <span>1. Convertio</span>
                            <ExternalLink size={14} className="group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a 
                            href="https://www.freeconvert.com/" 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-full px-4 py-3 rounded-lg bg-[#252525] hover:bg-[#333] border border-gray-700 text-blue-400 font-medium text-sm transition flex items-center justify-between group"
                        >
                            <span>2. FreeConvert</span>
                            <ExternalLink size={14} className="group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a 
                            href="https://cloudconvert.com/" 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-full px-4 py-3 rounded-lg bg-[#252525] hover:bg-[#333] border border-gray-700 text-blue-400 font-medium text-sm transition flex items-center justify-between group"
                        >
                            <span>3. CloudConvert</span>
                            <ExternalLink size={14} className="group-hover:translate-x-1 transition-transform" />
                        </a>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={() => setShowSuccessModal(false)}
                            className="w-full px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-sm transition"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
      )}
    </div>
  );
}
