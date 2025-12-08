
/// <reference lib="dom" />

import React, { useState, useRef, useEffect } from 'react';
import { EditorState, Template, VFXState, OverlayState } from '../types';
import { FONTS, VFX_TYPES, BG_ANIMATION_TYPES } from '../constants';
import { X, Check, ArrowLeft, Trash2, LayoutTemplate, ThumbsUp, ExternalLink, Upload, ImagePlus, MonitorPlay, Clipboard, FileInput, AlertCircle, MousePointerClick, Keyboard, Activity } from 'lucide-react';

interface Props {
    state: EditorState;
    view: 'global' | 'layer' | 'templates' | 'ai';
    setView: (v: 'global' | 'layer' | 'templates' | 'ai') => void;
    templates: Template[];
    onUpdateLayer: (id: string, updates: any) => void;
    onUpdateGlobal: (updates: any) => void;
    onUpdateVFX: (updates: Partial<VFXState>) => void;
    onUpdateOverlay: (updates: Partial<OverlayState>) => void;
    onLoadTemplate: (t: Template) => void;
    onDeleteTemplate: (id: string) => void;
    onDeleteLayer: (id: string) => void;
    onAIImageGenerated: (url: string, type: 'background' | 'overlay') => void;
}

export const RightSidebar: React.FC<Props> = ({
    state, view, setView, templates, onUpdateLayer, onUpdateGlobal, onUpdateVFX, onUpdateOverlay,
    onLoadTemplate, onDeleteTemplate, onDeleteLayer, onAIImageGenerated
}) => {
    const selectedLayer = state.layers.find(l => l.id === state.selectedLayerId);
    
    // AI Manual Workflow State
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isFocused, setIsFocused] = useState(false); // Track focus state
    const [pasteError, setPasteError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    
    // Reference to the External VisionCraft Window for Auto-Close
    const externalWindowRef = useRef<Window | null>(null);

    // --- PASTE LISTENER (CTRL+V) ---
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (view !== 'ai') return;
            let found = false;

            if (e.clipboardData && e.clipboardData.files.length > 0) {
                const file = e.clipboardData.files[0];
                if (file.type.startsWith('image/')) {
                    e.preventDefault();
                    const url = URL.createObjectURL(file);
                    setUploadedImage(url);
                    found = true;
                }
            }

            if (!found && e.clipboardData && e.clipboardData.items) {
                const items = e.clipboardData.items;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        const blob = items[i].getAsFile();
                        if (blob) {
                            e.preventDefault();
                            const url = URL.createObjectURL(blob);
                            setUploadedImage(url);
                            found = true;
                            break;
                        }
                    }
                }
            }

            if (!found) {
                const text = e.clipboardData?.getData('text');
                if (text && (text.startsWith('http') || text.startsWith('data:image'))) {
                    e.preventDefault();
                    setUploadedImage(text);
                    found = true;
                }
            }

            if (found) {
                setPasteError(null);
                dropZoneRef.current?.blur();
                
                // --- AUTO CLOSE LOGIC ---
                if (externalWindowRef.current) {
                    setTimeout(() => {
                        try {
                            if (!externalWindowRef.current?.closed) {
                                externalWindowRef.current?.close();
                            }
                        } catch (e) {
                            console.warn("Could not auto-close window", e);
                        }
                        externalWindowRef.current = null;
                    }, 500);
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [view]);

    // --- DRAG & DROP HANDLERS ---
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setUploadedImage(url);
            setPasteError(null);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setUploadedImage(url);
            setPasteError(null);
        }
    };

    const handleActivateZone = () => {
        dropZoneRef.current?.focus();
        setIsFocused(true);
        setPasteError(null);
    };

    const handleApplyImage = (type: 'background' | 'overlay') => {
        if (uploadedImage) {
            onAIImageGenerated(uploadedImage, type);
        }
    };
    
    const handleOpenVisionCraft = () => {
        const win = window.open(
            "https://ai.studio/apps/drive/1dl5FdDfhlOO0z7Fm895QThIL5a5SJhIP?fullscreenApplet=true", 
            "_blank"
        );
        externalWindowRef.current = win;
    };

    return (
        <div className="w-full md:w-72 bg-[#121212] flex flex-col border-l border-[#2a2a2a] h-[30vh] md:h-full z-20 shadow-2xl shrink-0">
            <div className="p-3 bg-[#181818] border-b border-[#2a2a2a] flex justify-between items-center h-12 shrink-0">
                <h2 className={`text-xs font-bold tracking-wide ${view === 'layer' ? 'text-yellow-400' : view === 'ai' ? 'text-purple-400' : 'text-blue-400'}`}>
                    {view === 'layer' ? 'EDIT LAYER' : view === 'ai' ? 'AI STUDIO EXTERNAL' : view === 'templates' ? 'TEMPLATES' : 'GLOBAL SETTINGS'}
                </h2>
                {view !== 'global' && (
                    <button onClick={() => setView('global')} className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-300 border border-gray-600 hover:bg-gray-700 flex items-center">
                        <ArrowLeft size={10} className="mr-1" /> Back
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-3 relative">
                
                {/* GLOBAL VIEW */}
                {view === 'global' && (
                    <>
                        {/* 1. BACKGROUND */}
                         <div className="bg-[#1a1a1a] p-2 rounded border border-[#2a2a2a]">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] font-bold text-gray-400">BACKGROUND CONFIG</label>
                            </div>
                            
                            {/* Position Controls */}
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <span className="text-[9px] text-gray-500 block">Scale</span>
                                    <input 
                                        type="range" min="0.1" max="5.0" step="0.1" 
                                        value={state.bgConfig.scale} 
                                        onChange={(e) => onUpdateGlobal({ bgConfig: { ...state.bgConfig, scale: parseFloat((e.target as HTMLInputElement).value) } })} 
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <span className="text-[9px] text-gray-500 block">Blur</span>
                                    <input 
                                        type="range" min="0" max="50" step="1" 
                                        value={state.bgConfig.blur} 
                                        onChange={(e) => onUpdateGlobal({ bgConfig: { ...state.bgConfig, blur: parseFloat((e.target as HTMLInputElement).value) } })} 
                                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <input type="number" placeholder="X" value={Math.round(state.bgConfig.x)} onChange={(e) => onUpdateGlobal({ bgConfig: { ...state.bgConfig, x: parseInt((e.target as HTMLInputElement).value) } })} className="bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded" />
                                <input type="number" placeholder="Y" value={Math.round(state.bgConfig.y)} onChange={(e) => onUpdateGlobal({ bgConfig: { ...state.bgConfig, y: parseInt((e.target as HTMLInputElement).value) } })} className="bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded" />
                            </div>

                            {/* Animation Controls (NEW) */}
                            <label className="text-[10px] font-bold text-orange-400 mb-1 flex items-center gap-1">
                                <Activity size={10} /> BG ANIMATION
                            </label>
                            <select 
                                value={state.bgConfig.animation || 'none'} 
                                onChange={(e) => onUpdateGlobal({ bgConfig: { ...state.bgConfig, animation: e.target.value } })}
                                className="w-full bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded mb-2"
                            >
                                {BG_ANIMATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            
                            {(state.bgConfig.animation && state.bgConfig.animation !== 'none') && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                    <div>
                                        <div className="flex justify-between text-[9px] text-gray-500"><span>Speed</span><span>{state.bgConfig.animSpeed || 1}x</span></div>
                                        <input 
                                            type="range" min="0.1" max="5" step="0.1" 
                                            value={state.bgConfig.animSpeed || 1} 
                                            onChange={(e) => onUpdateGlobal({ bgConfig: { ...state.bgConfig, animSpeed: parseFloat(e.target.value) } })} 
                                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[9px] text-gray-500"><span>Intensity</span><span>{state.bgConfig.animIntensity || 1}</span></div>
                                        <input 
                                            type="range" min="0.1" max="3" step="0.1" 
                                            value={state.bgConfig.animIntensity || 1} 
                                            onChange={(e) => onUpdateGlobal({ bgConfig: { ...state.bgConfig, animIntensity: parseFloat(e.target.value) } })} 
                                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2. OVERLAY / SOCIAL ACTIONS (NEW) */}
                        <div className="bg-[#1a1a1a] p-2 rounded border border-[#2a2a2a]">
                            <label className="text-[10px] font-bold text-red-400 mb-1 flex items-center gap-1">
                                <ThumbsUp size={10} /> SOCIAL ACTION BUTTON
                            </label>
                            <select 
                                value={state.overlayState?.type || 'none'} 
                                onChange={(e) => onUpdateOverlay({ type: (e.target.value as any) })}
                                className="w-full bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded mb-3"
                            >
                                <option value="none">None</option>
                                <option value="subscribe">🔴 Subscribe Button</option>
                                <option value="like">👍 Like Button</option>
                                <option value="follow">➕ Follow Button</option>
                            </select>
                            
                            {state.overlayState && state.overlayState.type !== 'none' && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-[9px] text-gray-500 block">Scale</span>
                                            <input type="range" min="0.5" max="2" step="0.1" value={state.overlayState.scale} onChange={(e) => onUpdateOverlay({ scale: parseFloat(e.target.value) })} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-gray-500 block">Y-Pos</span>
                                            <input type="range" min="-600" max="600" step="10" value={state.overlayState.y} onChange={(e) => onUpdateOverlay({ y: parseInt(e.target.value) })} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                             <span className="text-[9px] text-gray-500 block">X-Pos: {state.overlayState.x}</span>
                                             <input type="range" min="-300" max="300" step="10" value={state.overlayState.x} onChange={(e) => onUpdateOverlay({ x: parseInt(e.target.value) })} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. VFX */}
                        <div className="bg-[#1a1a1a] p-2 rounded border border-[#2a2a2a]">
                            <label className="text-[10px] font-bold text-green-500 mb-1 block">VFX & PARTICLES</label>
                            <select 
                                value={state.vfxState.type} 
                                onChange={(e) => onUpdateVFX({ type: (e.target as HTMLSelectElement).value })}
                                className="w-full bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded mb-3"
                            >
                                {VFX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            
                            {state.vfxState.type !== 'none' && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><span className="text-[9px] text-gray-500 block">Color</span><input type="color" value={state.vfxState.color} onChange={(e) => onUpdateVFX({ color: (e.target as HTMLInputElement).value })} className="w-full h-4 bg-transparent cursor-pointer" /></div>
                                        <div><span className="text-[9px] text-gray-500 block">Opacity</span><input type="range" min="0.1" max="1" step="0.1" value={state.vfxState.opacity} onChange={(e) => onUpdateVFX({ opacity: parseFloat((e.target as HTMLInputElement).value) })} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><span className="text-[9px] text-gray-500 block">Size</span><input type="range" min="0.1" max="3" step="0.1" value={state.vfxState.size} onChange={(e) => onUpdateVFX({ size: parseFloat((e.target as HTMLInputElement).value) })} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" /></div>
                                        <div><span className="text-[9px] text-gray-500 block">Speed</span><input type="range" min="0.1" max="3" step="0.1" value={state.vfxState.speed} onChange={(e) => onUpdateVFX({ speed: parseFloat((e.target as HTMLInputElement).value) })} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" /></div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* 4. AUDIO */}
                         <div className="bg-[#1a1a1a] p-2 rounded border border-[#2a2a2a]">
                            <label className="text-[10px] font-bold text-gray-400 mb-1 block">AUDIO MIXER</label>
                            <div className="mb-2">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>Video Vol</span><span>{Math.round(state.audioConfig.videoVol * 100)}%</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={state.audioConfig.videoVol} onChange={(e) => onUpdateGlobal({ audioConfig: { ...state.audioConfig, videoVol: parseFloat((e.target as HTMLInputElement).value) } })} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div className="mb-2">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>Layer Vol</span><span>{Math.round(state.audioConfig.layerVol ?? 1 * 100)}%</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={state.audioConfig.layerVol ?? 1} onChange={(e) => onUpdateGlobal({ audioConfig: { ...state.audioConfig, layerVol: parseFloat((e.target as HTMLInputElement).value) } })} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] text-gray-500"><span>Music Vol</span><span>{Math.round(state.audioConfig.musicVol * 100)}%</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={state.audioConfig.musicVol} onChange={(e) => onUpdateGlobal({ audioConfig: { ...state.audioConfig, musicVol: parseFloat((e.target as HTMLInputElement).value) } })} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                            </div>
                        </div>

                        <div className="bg-[#1a1a1a] p-2 rounded border border-[#2a2a2a]">
                            <label className="text-[10px] font-bold text-red-400 mb-1 block">DURATION LIMIT</label>
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400">Stop after:</span>
                                <input 
                                    type="number" 
                                    value={state.limitDuration} 
                                    onChange={(e) => onUpdateGlobal({ limitDuration: parseFloat((e.target as HTMLInputElement).value) })}
                                    className="bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded w-16 text-right"
                                />
                                <span className="text-[10px] text-gray-500">sec (0 = auto)</span>
                            </div>
                        </div>
                    </>
                )}

                {/* LAYER VIEW */}
                {view === 'layer' && selectedLayer && (
                    <>
                        <div className="bg-[#1a1a1a] p-2 rounded border border-[#2a2a2a]">
                            <label className="text-[10px] font-bold text-gray-400 mb-1 block">TRANSFORM</label>
                             <div className="mb-2">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>Scale</span><span>{selectedLayer.scale.toFixed(1)}</span></div>
                                <input type="range" min="0.1" max="5" step="0.1" value={selectedLayer.scale} onChange={(e) => onUpdateLayer(selectedLayer.id, { scale: parseFloat((e.target as HTMLInputElement).value) })} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                            </div>
                             <div className="mb-2">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>Rotation</span><span>{selectedLayer.rotation}°</span></div>
                                <input type="range" min="-180" max="180" step="5" value={selectedLayer.rotation} onChange={(e) => onUpdateLayer(selectedLayer.id, { rotation: parseInt((e.target as HTMLInputElement).value) })} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" placeholder="X" value={Math.round(selectedLayer.x)} onChange={(e) => onUpdateLayer(selectedLayer.id, { x: parseInt((e.target as HTMLInputElement).value) })} className="bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded" />
                                <input type="number" placeholder="Y" value={Math.round(selectedLayer.y)} onChange={(e) => onUpdateLayer(selectedLayer.id, { y: parseInt((e.target as HTMLInputElement).value) })} className="bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded" />
                            </div>
                        </div>

                        {selectedLayer.type === 'text' && (
                             <div className="bg-[#1a1a1a] p-2 rounded border border-[#2a2a2a]">
                                <label className="text-[10px] font-bold text-gray-400 mb-1 block">TEXT STYLE</label>
                                <textarea rows={2} value={selectedLayer.content} onChange={(e) => onUpdateLayer(selectedLayer.id, { content: (e.target as HTMLTextAreaElement).value })} className="bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded w-full mb-2" />
                                <select value={selectedLayer.fontFamily} onChange={(e) => onUpdateLayer(selectedLayer.id, { fontFamily: (e.target as HTMLSelectElement).value })} className="w-full bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded mb-2">
                                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div><span className="text-[9px] text-gray-500 block">Color</span><input type="color" value={selectedLayer.color} onChange={(e) => onUpdateLayer(selectedLayer.id, { color: (e.target as HTMLInputElement).value })} className="w-full h-5 bg-transparent cursor-pointer" /></div>
                                    <div><span className="text-[9px] text-gray-500 block">Bg Color</span>
                                        <div className="flex items-center">
                                            <input type="color" value={selectedLayer.bgColor} onChange={(e) => onUpdateLayer(selectedLayer.id, { bgColor: (e.target as HTMLInputElement).value })} className="w-6 h-5 bg-transparent cursor-pointer mr-1" />
                                            <input type="checkbox" checked={selectedLayer.bgTransparent} onChange={(e) => onUpdateLayer(selectedLayer.id, { bgTransparent: (e.target as HTMLInputElement).checked })} />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <button onClick={() => onUpdateLayer(selectedLayer.id, { bold: !selectedLayer.bold })} className={`text-[10px] py-1 rounded border border-gray-600 ${selectedLayer.bold ? 'bg-blue-600' : 'bg-gray-800'}`}>Bold</button>
                                    <button onClick={() => onUpdateLayer(selectedLayer.id, { italic: !selectedLayer.italic })} className={`text-[10px] py-1 rounded border border-gray-600 ${selectedLayer.italic ? 'bg-blue-600' : 'bg-gray-800'}`}>Italic</button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                        <span className="text-[9px] text-gray-500 block">Outline Width ({selectedLayer.outlineWidth || 0})</span>
                                        <input 
                                            type="range" min="0" max="20" step="1" 
                                            value={selectedLayer.outlineWidth || 0} 
                                            onChange={(e) => onUpdateLayer(selectedLayer.id, { outlineWidth: parseInt((e.target as HTMLInputElement).value) })} 
                                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" 
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-gray-500 block">Outline Color</span>
                                        <input 
                                            type="color" 
                                            value={selectedLayer.outlineColor || '#000000'} 
                                            onChange={(e) => onUpdateLayer(selectedLayer.id, { outlineColor: (e.target as HTMLInputElement).value })} 
                                            className="w-full h-5 bg-transparent cursor-pointer" 
                                        />
                                    </div>
                                </div>
                             </div>
                        )}
                        
                        <div className="bg-[#1a1a1a] p-2 rounded border border-[#2a2a2a]">
                             <button 
                                onClick={() => onDeleteLayer(selectedLayer.id)}
                                className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-500 text-[10px] py-2 rounded border border-red-900/50 flex items-center justify-center transition"
                             >
                                <Trash2 size={12} className="mr-2" /> Delete Layer
                             </button>
                        </div>
                    </>
                )}

                {/* AI VIEW */}
                {view === 'ai' && (
                    <div className="space-y-6 px-1">
                        {/* AI steps content ... same as before */}
                        <div className="bg-[#1a1a1a] p-4 rounded border border-purple-900/50 relative">
                            <div className="absolute top-0 right-0 bg-purple-900 text-purple-200 text-[9px] font-bold px-2 py-0.5 rounded-bl">Step 1</div>
                            <h3 className="text-xs font-bold text-purple-400 mb-2 flex items-center gap-2">
                                <MonitorPlay size={14} /> BUAT GAMBAR
                            </h3>
                            <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
                                Buka VisionCraft AI di Google AI Studio di tab baru untuk membuat gambar berkualitas tinggi secara gratis tanpa API Key.
                            </p>
                            <button 
                                onClick={handleOpenVisionCraft}
                                className="w-full bg-gradient-to-r from-purple-700 to-blue-700 hover:from-purple-600 hover:to-blue-600 text-white text-xs py-3 rounded flex items-center justify-center gap-2 font-bold transition shadow-lg"
                            >
                                <ExternalLink size={14} />
                                BUKA VISIONCRAFT AI
                            </button>
                        </div>

                        <div className="bg-[#1a1a1a] p-4 rounded border border-gray-700 relative">
                            <div className="absolute top-0 right-0 bg-gray-700 text-gray-200 text-[9px] font-bold px-2 py-0.5 rounded-bl">Step 2</div>
                            <h3 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-2">
                                <Upload size={14} /> IMPORT HASIL
                            </h3>
                            <p className="text-[10px] text-gray-400 mb-3">
                                Copy gambar dari AI Studio, lalu tempel di sini.
                            </p>

                            {!uploadedImage ? (
                                <div 
                                    ref={dropZoneRef}
                                    tabIndex={0}
                                    onClick={handleActivateZone}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`border-2 border-dashed rounded p-4 flex flex-col items-center justify-center cursor-pointer transition h-40 relative outline-none 
                                        ${isFocused 
                                            ? 'border-blue-400 bg-blue-900/20 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                                            : isDragging ? 'border-blue-400 bg-blue-900/20' : 'border-gray-700 hover:border-blue-500 hover:bg-[#202020] bg-[#151515]'}
                                    `}
                                >
                                    {isFocused ? (
                                        <div className="flex flex-col items-center animate-in zoom-in duration-200">
                                            <Keyboard size={32} className="text-blue-400 mb-2 animate-pulse" />
                                            <span className="text-xs text-blue-200 font-bold text-center">
                                                SIAP! <br/>TEKAN <span className="text-white bg-blue-600 px-1 rounded">Ctrl + V</span> SEKARANG
                                            </span>
                                        </div>
                                    ) : (
                                        <>
                                            <MousePointerClick size={24} className={`mb-2 text-gray-500`} />
                                            <span className="text-[10px] text-gray-400 font-bold text-center">
                                                KLIK DISINI UNTUK<br/>MENGAKTIFKAN PASTE
                                            </span>
                                        </>
                                    )}
                                    
                                    <div className="absolute bottom-2 right-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                            className="bg-[#222] hover:bg-[#333] border border-gray-600 text-gray-400 text-[9px] p-1.5 rounded-full"
                                            title="Upload Manual File"
                                        >
                                            <Upload size={10} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="relative group">
                                        <img src={uploadedImage} className="w-full rounded border border-gray-600 max-h-48 object-contain bg-black" />
                                        <button 
                                            onClick={() => setUploadedImage(null)}
                                            className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full hover:bg-red-500 shadow-lg opacity-0 group-hover:opacity-100 transition"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-bottom-2 fade-in">
                                        <button 
                                            onClick={() => handleApplyImage('background')}
                                            className="bg-blue-900/40 border border-blue-600 hover:bg-blue-800 text-blue-100 text-[10px] py-2.5 rounded font-bold transition flex items-center justify-center gap-1"
                                        >
                                            <LayoutTemplate size={12} />
                                            SET BG
                                        </button>
                                        <button 
                                            onClick={() => handleApplyImage('overlay')}
                                            className="bg-purple-900/40 border border-purple-600 hover:bg-purple-800 text-purple-100 text-[10px] py-2.5 rounded font-bold transition flex items-center justify-center gap-1"
                                        >
                                            <ImagePlus size={12} />
                                            ADD LAYER
                                        </button>
                                    </div>
                                </div>
                            )}
                            
                            <input 
                                ref={fileInputRef} 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleFileUpload} 
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
