
/// <reference lib="dom" />

import React, { useState, useEffect } from 'react';
import { EditorState, Template, VFXState, OverlayState } from '../types';
import { FONTS, VFX_TYPES } from '../constants';
import { X, Check, Loader2, ArrowLeft, Trash2, Key, ExternalLink, TriangleAlert, LayoutTemplate, ThumbsUp } from 'lucide-react';
import { generateAIImage } from '../services/gemini';

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
    
    // AI State
    const [aiPrompt, setAiPrompt] = React.useState('');
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [aiResult, setAiResult] = React.useState<string | null>(null);
    const [aiMode, setAiMode] = React.useState<'background' | 'overlay'>('background');

    const handleGenerate = async () => {
        if (!aiPrompt) return;
        
        setIsGenerating(true);
        setAiResult(null);
        try {
            const url = await generateAIImage(aiPrompt);
            setAiResult(url);
        } catch (e: any) {
            window.alert("Gagal Generate: " + (e.message || "Unknown error. Check API Key configuration."));
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="w-full md:w-72 bg-[#121212] flex flex-col border-l border-[#2a2a2a] h-[30vh] md:h-full z-20 shadow-2xl shrink-0">
            <div className="p-3 bg-[#181818] border-b border-[#2a2a2a] flex justify-between items-center h-12 shrink-0">
                <h2 className={`text-xs font-bold tracking-wide ${view === 'layer' ? 'text-yellow-400' : view === 'ai' ? 'text-purple-400' : 'text-blue-400'}`}>
                    {view === 'layer' ? 'EDIT LAYER' : view === 'ai' ? 'AI GENERATOR' : view === 'templates' ? 'TEMPLATES' : 'GLOBAL SETTINGS'}
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
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" placeholder="X" value={Math.round(state.bgConfig.x)} onChange={(e) => onUpdateGlobal({ bgConfig: { ...state.bgConfig, x: parseInt((e.target as HTMLInputElement).value) } })} className="bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded" />
                                <input type="number" placeholder="Y" value={Math.round(state.bgConfig.y)} onChange={(e) => onUpdateGlobal({ bgConfig: { ...state.bgConfig, y: parseInt((e.target as HTMLInputElement).value) } })} className="bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded" />
                            </div>
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

                {/* TEMPLATE VIEW (UPDATED) */}
                {view === 'templates' && (
                     <div className="bg-gray-800/50 p-3 rounded border border-orange-900/50">
                        <h3 className="text-xs font-bold text-orange-400 mb-2 border-b border-gray-700 pb-1">SAVED TEMPLATES</h3>
                        {templates.length === 0 && <div className="text-center text-gray-500 text-[10px] py-4">No templates found.</div>}
                        <div className="space-y-3">
                            {templates.map(t => (
                                <div key={t.id} className="bg-[#121212] p-3 rounded border border-gray-700 flex flex-col gap-2 shadow-lg">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-xs font-bold text-gray-300 flex items-center gap-1">
                                                <LayoutTemplate size={10} className="text-orange-500"/> {t.name}
                                            </div>
                                            <div className="text-[9px] text-gray-600 ml-3.5">{new Date(t.timestamp).toLocaleDateString()}</div>
                                        </div>
                                        <button 
                                            onClick={() => onDeleteTemplate(t.id)} 
                                            className="text-gray-600 hover:text-red-500 p-1 rounded hover:bg-red-900/10 transition"
                                            title="Delete Template"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    
                                    <button 
                                        onClick={() => onLoadTemplate(t)} 
                                        className="w-full bg-green-900/20 hover:bg-green-600 border border-green-900/50 hover:border-green-500 text-green-500 hover:text-white py-2 rounded text-[10px] font-bold flex items-center justify-center gap-2 transition-all duration-200 group"
                                    >
                                        <Check size={12} className="group-hover:scale-125 transition" /> USE THIS TEMPLATE
                                    </button>
                                </div>
                            ))}
                        </div>
                     </div>
                )}

                {/* AI VIEW (UPDATED) */}
                {view === 'ai' && (
                    <div className="space-y-4">
                        <div className="bg-[#1a1a1a] p-3 rounded border border-purple-900/50 relative">
                            <label className="text-[10px] font-bold text-purple-400 mb-2 block border-b border-gray-700 pb-1">AI IMAGE GENERATOR</label>
                            
                            <div className="flex gap-2 mb-3">
                                <button 
                                    onClick={() => setAiMode('background')}
                                    className={`flex-1 text-[10px] py-1 rounded border ${aiMode === 'background' ? 'bg-purple-700 border-purple-500' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
                                >
                                    Background
                                </button>
                                <button 
                                    onClick={() => setAiMode('overlay')}
                                    className={`flex-1 text-[10px] py-1 rounded border ${aiMode === 'overlay' ? 'bg-blue-700 border-blue-500' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
                                >
                                    Overlay
                                </button>
                            </div>

                            <div className="mb-2">
                                <label className="text-[9px] text-gray-500 block mb-1">Image Prompt:</label>
                                <textarea 
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt((e.target as HTMLTextAreaElement).value)}
                                    rows={3} 
                                    className="bg-[#171717] border border-[#404040] text-white px-2 py-1 text-xs rounded w-full focus:outline-none focus:border-purple-500" 
                                    placeholder={aiMode === 'background' ? "Futuristic news studio, dark theme..." : "A cute cat sticker, white background..."}
                                />
                            </div>

                            <button 
                                onClick={handleGenerate} 
                                disabled={isGenerating || !aiPrompt}
                                className="w-full bg-purple-700 hover:bg-purple-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-gray-700 text-white text-xs py-2 rounded font-bold mb-2 flex justify-center items-center transition"
                            >
                                {isGenerating ? <><Loader2 size={12} className="animate-spin mr-2" /> Generating...</> : "Generate Image"}
                            </button>
                            
                            {aiResult && (
                                <div className="flex flex-col gap-2 animate-in fade-in duration-300">
                                    <img src={aiResult} className="w-full rounded border border-gray-600 object-cover h-32" alt="Generated" />
                                    <button 
                                        onClick={() => { onAIImageGenerated(aiResult, aiMode); setAiResult(null); }}
                                        className="w-full bg-green-700 hover:bg-green-600 text-white text-xs py-1 rounded flex items-center justify-center"
                                    >
                                        <Check size={12} className="mr-1" /> Use Image
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
