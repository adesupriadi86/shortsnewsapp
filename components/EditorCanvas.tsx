
/// <reference lib="dom" />

import React, { useRef, useEffect, useCallback } from 'react';
import { EditorState } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, ASPECT_RATIO } from '../constants';
import { drawLayer, drawBackground } from '../utils/canvasRenderer';
import { drawOverlay } from '../utils/overlayRenderer'; // NEW IMPORT
import { VFXSystem } from '../utils/vfx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  state: EditorState;
  videoRef: React.RefObject<HTMLVideoElement>;
  bgImageRef: React.RefObject<HTMLImageElement>;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayerPos: (id: string, x: number, y: number) => void;
  onUpdateBgPos: (x: number, y: number) => void;
  onAutoStop: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onPrevPreview?: () => void;
  onNextPreview?: () => void;
  batchIndex?: number;
  batchTotal?: number;
}

export const EditorCanvas: React.FC<Props> = ({ 
    state, videoRef, bgImageRef, onSelectLayer, onUpdateLayerPos, onUpdateBgPos, onAutoStop, canvasRef,
    onPrevPreview, onNextPreview, batchIndex, batchTotal
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionLayerRef = useRef<HTMLDivElement>(null);
  const vfxSystem = useRef<VFXSystem | null>(null);

  // Lazy initialization of VFXSystem
  if (!vfxSystem.current) {
      vfxSystem.current = new VFXSystem();
  }
  
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  
  // Interaction state
  const isDragging = useRef(false);
  const isDraggingBg = useRef(false);
  const startDragPos = useRef({ x: 0, y: 0 });
  
  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
         // Logic to fit canvas in container while maintaining aspect ratio
         const parent = containerRef.current.parentElement;
         if (!parent) return;
         
         const w = parent.clientWidth;
         const h = parent.clientHeight;
         
         const aw = w;
         const ah = h;
         
         let fw, fh;
         if (aw / ah < ASPECT_RATIO) {
             fw = aw;
             fh = fw / ASPECT_RATIO;
         } else {
             fh = ah;
             fw = fh * ASPECT_RATIO;
         }
         containerRef.current.style.width = `${fw}px`;
         containerRef.current.style.height = `${fh}px`;
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Init
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Main Render Loop
  const render = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw BG
    drawBackground(ctx, state.bgConfig, videoRef.current!, bgImageRef.current);

    // Update & Draw VFX
    vfxSystem.current?.update(state.vfxState, ctx);

    // Draw Layers
    [...state.layers].forEach(layer => {
        drawLayer(ctx, layer, layer.id === state.selectedLayerId && !state.isRecording);
    });

    // Draw Overlay (Social Buttons) - DRAW ON TOP OF LAYERS
    if (state.overlayState) {
        drawOverlay(ctx, state.overlayState);
    }

    // Loop logic check
    if (state.isPlaying || state.isRecording) {
        // We use wall-clock time for the logical duration check (auto-stop)
        // This is crucial because videoRef.currentTime resets if we loop the video.
        const elapsed = (Date.now() - startTimeRef.current) / 1000;

        // Auto Stop Check
        // If limitDuration > 0, we use it.
        // If limitDuration == 0 (auto), we use videoMaxDuration if available.
        const max = state.limitDuration > 0 
            ? state.limitDuration 
            : (state.bgConfig.type === 'video' ? state.videoMaxDuration : 0);
        
        if (max > 0 && elapsed >= max) {
            onAutoStop();
        }
    }

    if (state.isPlaying || state.isRecording) {
        requestRef.current = requestAnimationFrame(render);
    }
  }, [state, onAutoStop]);

  // Sync loop start/stop with state
  useEffect(() => {
      if (state.isPlaying || state.isRecording) {
          if (!startTimeRef.current) startTimeRef.current = Date.now();
          requestRef.current = requestAnimationFrame(render);
      } else {
          // One last render to ensure static state is correct
          requestAnimationFrame(render);
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
          startTimeRef.current = 0;
      }
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
  }, [state.isPlaying, state.isRecording, render]);

  // Also trigger render when static state changes
  useEffect(() => {
      if (!state.isPlaying && !state.isRecording) {
          requestAnimationFrame(render);
      }
  }, [state, render]);

  // NEW: Listen to video events to force redraw when frames are ready (solves blank screen on upload)
  useEffect(() => {
      const vid = videoRef.current;
      if (!vid) return;

      const handleFrameReady = () => {
          if (!state.isPlaying && !state.isRecording) {
              requestAnimationFrame(render);
          }
      };

      vid.addEventListener('canplay', handleFrameReady);
      vid.addEventListener('seeked', handleFrameReady);
      vid.addEventListener('loadeddata', handleFrameReady);

      return () => {
          vid.removeEventListener('canplay', handleFrameReady);
          vid.removeEventListener('seeked', handleFrameReady);
          vid.removeEventListener('loadeddata', handleFrameReady);
      };
  }, [videoRef, state.isPlaying, state.isRecording, render]);


  // Interaction Handlers
  const getCoords = (e: MouseEvent | TouchEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const cx = (e as any).touches ? (e as any).touches[0].clientX : (e as any).clientX;
      const cy = (e as any).touches ? (e as any).touches[0].clientY : (e as any).clientY;
      // Map to canvas coordinate space
      return {
          x: (cx - rect.left) * (CANVAS_WIDTH / rect.width),
          y: (cy - rect.top) * (CANVAS_HEIGHT / rect.height)
      };
  };

  const handleMouseDown = (e: any) => {
      e.preventDefault();
      const p = getCoords(e.nativeEvent);
      startDragPos.current = p;
      
      // Hit Test (reverse order for top-most first)
      const hit = [...state.layers].reverse().find(l => {
         const w = (l.width || 300) * l.scale;
         const h = (l.height || 100) * l.scale;
         // Simple rect collision, ideally OBB
         return (p.x >= l.x - w/2 && p.x <= l.x + w/2 && p.y >= l.y - h/2 && p.y <= l.y + h/2);
      });

      if (hit) {
          onSelectLayer(hit.id);
          isDragging.current = true;
      } else {
          onSelectLayer(null);
          isDraggingBg.current = true;
      }
  };

  const handleMouseMove = (e: any) => {
      if (!isDragging.current && !isDraggingBg.current) return;
      e.preventDefault();
      const p = getCoords(e.nativeEvent);
      const dx = p.x - startDragPos.current.x;
      const dy = p.y - startDragPos.current.y;

      if (isDragging.current && state.selectedLayerId) {
          const l = state.layers.find(x => x.id === state.selectedLayerId);
          if (l) {
            onUpdateLayerPos(l.id, l.x + dx, l.y + dy);
          }
      } else if (isDraggingBg.current) {
          onUpdateBgPos(state.bgConfig.x + dx, state.bgConfig.y + dy);
      }

      startDragPos.current = p;
  };

  const handleMouseUp = () => {
      isDragging.current = false;
      isDraggingBg.current = false;
  };

  return (
    <div className="flex-1 flex items-center justify-center relative bg-black h-[40vh] md:h-full" id="canvasArea" onClick={(e) => { if((e.target as any).id === 'canvasArea') onSelectLayer(null); }}>
         {/* Duration & Navigation Overlay */}
         <div className="absolute top-4 z-40 flex items-center gap-3 pointer-events-none">
             {/* PREV BUTTON */}
             {(batchTotal || 0) > 1 && (
                 <button 
                    onClick={(e) => { e.stopPropagation(); onPrevPreview?.(); }}
                    className="pointer-events-auto p-2 rounded-full bg-black/50 border border-white/10 text-white hover:bg-blue-600 hover:scale-110 transition shadow-lg"
                 >
                     <ChevronLeft size={16} />
                 </button>
             )}

             <div className="bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10 text-[10px] text-gray-300 flex gap-3 shadow-lg items-center">
                 {/* Batch Counter */}
                 {(batchTotal || 0) > 0 && (
                     <span className="font-bold text-blue-400 border-r border-white/20 pr-3 mr-1">
                        {(batchIndex || 0) + 1} / {batchTotal}
                     </span>
                 )}
                 <span>⏱️ Duration: <span className="text-white font-mono font-bold">
                     {state.limitDuration > 0 ? state.limitDuration.toFixed(1) : (state.bgConfig.type === 'image' ? 'Manual' : state.videoMaxDuration.toFixed(1))}s
                 </span></span>
             </div>

             {/* NEXT BUTTON */}
             {(batchTotal || 0) > 1 && (
                 <button 
                    onClick={(e) => { e.stopPropagation(); onNextPreview?.(); }}
                    className="pointer-events-auto p-2 rounded-full bg-black/50 border border-white/10 text-white hover:bg-blue-600 hover:scale-110 transition shadow-lg"
                 >
                     <ChevronRight size={16} />
                 </button>
             )}
         </div>
         
         <div id="canvasContainer" ref={containerRef} className="relative shadow-2xl border border-[#333]">
             <canvas 
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="w-full h-full block"
             />
             <div 
                ref={interactionLayerRef}
                className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing touch-none"
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
                onMouseMove={handleMouseMove}
                onTouchMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchEnd={handleMouseUp}
                onMouseLeave={handleMouseUp}
             ></div>
         </div>
    </div>
  );
};
