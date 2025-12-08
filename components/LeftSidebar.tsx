
import React, { useRef } from 'react';
import { EditorState } from '../types';
import { FolderOpen, Save, Wand2, Video, Music, Image as ImageIcon, Type, Trash2, Camera, Globe, RotateCcw, Scissors, Layers } from 'lucide-react';

interface Props {
    state: EditorState;
    onAddLayer: (type: 'text' | 'image' | 'video', file?: File) => void;
    onBgUpload: (file: File) => void;
    // --- NEW BATCH PROPS ---
    onBatchBgUpload: (files: File[]) => void;
    onBatchAudioUpload: (files: File[]) => void;
    onBatchLayerUpload: (files: File[]) => void; // Added
    // -----------------------
    onAudioUpload: (file: File) => void;
    onClearBg: () => void;
    onClearAudio: () => void;
    onSelectLayer: (id: string) => void;
    onDeleteLayer: (id: string) => void;
    onTrimAudio: (val: number) => void;
    onOpenTemplates: () => void;
    onSaveTemplate: (name: string) => void;
    onOpenAI: () => void;
    onOpenNews: () => void;
    onOpenLongVideo: () => void; // New Prop
    onAddCamera: () => void;
    onAddBgCamera: () => void;
    onReset: () => void;
    audioDuration: number;
}

export const LeftSidebar: React.FC<Props> = ({
    state, onAddLayer, onBgUpload, onBatchBgUpload, onBatchAudioUpload, onBatchLayerUpload, onAudioUpload, onClearBg, onClearAudio,
    onSelectLayer, onDeleteLayer, onTrimAudio, onOpenTemplates, onSaveTemplate, 
    onOpenAI, onOpenNews, onOpenLongVideo, onAddCamera, onAddBgCamera, onReset
}) => {
    const [tplName, setTplName] = React.useState('');
    const fileInputBgRef = useRef<HTMLInputElement>(null);
    const fileInputBatchBgRef = useRef<HTMLInputElement>(null);
    const fileInputAudioRef = useRef<HTMLInputElement>(null);
    const fileInputBatchAudioRef = useRef<HTMLInputElement>(null);
    const fileInputOverlayRef = useRef<HTMLInputElement>(null);
    const fileInputBatchLayerRef = useRef<HTMLInputElement>(null); // Added

    return (
        <div className="w-full md:w-72 bg-[#121212] flex flex-col border-r border-[#2a2a2a] h-[35vh] md:h-full z-20 shadow-2xl shrink-0">
            
            {/* HEADER */}
            <div className="p-4 bg-[#181818] border-b border-[#2a2a2a] flex justify-between items-center shrink-0">
                <h1 className="text-sm font-bold text-white tracking-wide flex items-center">
                    <span className="text-blue-500 mr-2">⚡</span> ShortsNews
                </h1>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]" title="System Ready"></div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-4">
                
                {/* Project Management */}
                <div className="grid grid-cols-2 gap-2 border-b border-[#262626] pb-3">
                    <button onClick={onOpenTemplates} className="bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] rounded py-2 text-[10px] flex flex-col items-center text-orange-400 transition">
                        <FolderOpen size={14} className="mb-1" /> Templates
                    </button>
                    <button onClick={onOpenNews} className="bg-blue-900/20 hover:bg-blue-900/40 border border-blue-900/50 rounded py-2 text-[10px] flex flex-col items-center text-blue-400 shadow-lg shadow-blue-900/10 transition">
                        <Globe size={14} className="mb-1" /> News
                    </button>
                </div>

                {/* Save Template */}
                <div className="flex gap-2 border-b border-[#262626] pb-3">
                    <input 
                        type="text" placeholder="Save template..." value={tplName}
                        onChange={(e) => setTplName(e.target.value)}
                        className="bg-[#171717] border border-[#404040] text-white px-2 py-1 text-[10px] rounded w-full focus:border-blue-500 outline-none"
                    />
                    <button onClick={() => { if(tplName) { onSaveTemplate(tplName); setTplName(''); } }} className="bg-orange-700 hover:bg-orange-600 text-white px-2 py-1 rounded transition">
                        <Save size={14} />
                    </button>
                </div>

                {/* AI Gen */}
                <button onClick={onOpenAI} className="w-full bg-gradient-to-r from-purple-900 to-blue-900 border border-purple-700 rounded py-3 text-xs text-white font-bold flex items-center justify-center shadow-lg group">
                    <Wand2 size={14} className="mr-2 text-yellow-300 group-hover:rotate-12 transition" /> AI GENERATE
                </button>

                {/* --- BACKGROUND SECTION (UPDATED) --- */}
                <div className="border-t border-[#262626] pt-3">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-bold text-blue-400">BACKGROUND</label>
                        <div className="flex gap-1 items-center">
                            {/* LONG BUTTON */}
                            <button 
                                onClick={onOpenLongVideo}
                                className="bg-orange-900/30 text-orange-300 px-2 py-0.5 rounded text-[9px] hover:bg-orange-900/50 border border-orange-800 transition flex items-center gap-1"
                                title="Process Long Video (Splitter)"
                            >
                                <Scissors size={8} /> LONG
                            </button>
                            
                            {/* BATCH BUTTON */}
                            <button 
                                onClick={() => fileInputBatchBgRef.current?.click()} 
                                className="bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded text-[9px] hover:bg-blue-900/50 border border-blue-800 transition"
                                title="Upload multiple media for Autopilot"
                            >
                                + BATCH
                            </button>
                            <button onClick={onAddBgCamera} className="bg-[#222] p-1 rounded hover:bg-[#333] text-blue-400" title="Cam"><Camera size={12}/></button>
                            <button onClick={onClearBg} className="bg-[#222] p-1 rounded hover:bg-[#333] text-red-400" title="Clear"><Trash2 size={12}/></button>
                        </div>
                    </div>

                    {/* BATCH QUEUE DISPLAY */}
                    {state.batchVideos.length > 0 && (
                        <div className="mb-2 bg-[#151515] border border-blue-900/30 rounded p-2">
                            <p className="text-[9px] text-blue-400 mb-1 font-bold flex justify-between">
                                <span>Queue: {state.batchVideos.length} Media</span>
                            </p>
                            <div className="max-h-20 overflow-y-auto custom-scrollbar space-y-1">
                                {state.batchVideos.map((f, i) => (
                                    <div key={i} className="text-[9px] text-gray-400 truncate bg-[#222] px-1 rounded flex items-center">
                                        <span className="text-blue-500 mr-1">{i+1}.</span> {f.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div onClick={() => fileInputBgRef.current?.click()} className="bg-[#1a1a1a] border border-dashed border-gray-700 rounded p-3 text-center cursor-pointer hover:bg-[#222] transition">
                        <Video size={16} className="mx-auto text-gray-500 mb-1" />
                        <span className="text-[10px] text-gray-400">{state.bgConfig.type !== 'none' ? 'Media Loaded' : 'Upload Single BG'}</span>
                    </div>
                    
                    {/* INPUTS (Allowed video/image for batch) */}
                    <input ref={fileInputBgRef} type="file" accept="video/*,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onBgUpload(e.target.files[0])} />
                    <input ref={fileInputBatchBgRef} type="file" multiple accept="video/*,image/*" className="hidden" onChange={(e) => e.target.files && e.target.files.length > 0 && onBatchBgUpload(Array.from(e.target.files) as File[])} />
                </div>

                {/* --- AUDIO SECTION (UPDATED) --- */}
                <div className="border-t border-[#262626] pt-3">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-bold text-purple-400">AUDIO</label>
                        <div className="flex gap-1">
                            {/* BATCH BUTTON */}
                             <button 
                                onClick={() => fileInputBatchAudioRef.current?.click()} 
                                className="bg-purple-900/30 text-purple-300 px-2 py-0.5 rounded text-[9px] hover:bg-purple-900/50 border border-purple-800 transition"
                            >
                                + BATCH
                            </button>
                            <button onClick={onClearAudio} className="bg-[#222] p-1 rounded hover:bg-[#333] text-red-400" title="Clear"><Trash2 size={12}/></button>
                        </div>
                    </div>
                    
                    {/* BATCH QUEUE DISPLAY */}
                    {state.batchAudios.length > 0 && (
                        <div className="mb-2 bg-[#151515] border border-purple-900/30 rounded p-2">
                            <p className="text-[9px] text-purple-400 mb-1 font-bold">Stock: {state.batchAudios.length} Audios</p>
                            <div className="max-h-20 overflow-y-auto custom-scrollbar space-y-1">
                                {state.batchAudios.map((f, i) => (
                                    <div key={i} className="text-[9px] text-gray-400 truncate bg-[#222] px-1 rounded">{f.name}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div onClick={() => fileInputAudioRef.current?.click()} className="bg-[#1a1a1a] border border-dashed border-gray-700 rounded p-3 text-center cursor-pointer hover:bg-[#222] transition">
                        <Music size={16} className="mx-auto text-gray-500 mb-1" />
                        <span className="text-[10px] text-gray-400">{state.audioConfig.totalDuration > 0 ? 'Audio Loaded' : 'Upload Single Audio'}</span>
                    </div>
                    <input ref={fileInputAudioRef} type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && onAudioUpload(e.target.files[0])} />
                    <input ref={fileInputBatchAudioRef} type="file" multiple accept="audio/*" className="hidden" onChange={(e) => e.target.files && e.target.files.length > 0 && onBatchAudioUpload(Array.from(e.target.files) as File[])} />
                    
                    {state.audioConfig.totalDuration > 0 && (
                        <input type="range" min="0" max={state.audioConfig.totalDuration} step="0.1" value={state.audioConfig.trim} onChange={(e) => onTrimAudio(parseFloat(e.target.value))} className="w-full mt-2 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                    )}
                </div>

                {/* Layers */}
                <div className="border-t border-[#262626] pt-3">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-bold text-yellow-400">LAYERS</label>
                        {/* BATCH BUTTON FOR LAYERS */}
                        <button 
                            onClick={() => fileInputBatchLayerRef.current?.click()} 
                            className="bg-yellow-900/30 text-yellow-300 px-2 py-0.5 rounded text-[9px] hover:bg-yellow-900/50 border border-yellow-800 transition"
                            title="Batch Overlay Layers"
                        >
                            + BATCH
                        </button>
                    </div>

                    {/* BATCH QUEUE DISPLAY FOR LAYERS */}
                    {state.batchOverlays && state.batchOverlays.length > 0 && (
                        <div className="mb-2 bg-[#151515] border border-yellow-900/30 rounded p-2">
                            <p className="text-[9px] text-yellow-400 mb-1 font-bold">Queue: {state.batchOverlays.length} Overlays</p>
                            <div className="max-h-20 overflow-y-auto custom-scrollbar space-y-1">
                                {state.batchOverlays.map((f, i) => (
                                    <div key={i} className="text-[9px] text-gray-400 truncate bg-[#222] px-1 rounded flex items-center">
                                        <span className="text-yellow-500 mr-1">{i+1}.</span> {f.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-1 mb-2">
                        <button onClick={() => fileInputOverlayRef.current?.click()} className="bg-[#222] hover:bg-[#333] py-2 rounded text-[10px] flex flex-col items-center text-gray-300"><ImageIcon size={12}/> Media</button>
                        <button onClick={() => onAddLayer('text')} className="bg-[#222] hover:bg-[#333] py-2 rounded text-[10px] flex flex-col items-center text-gray-300"><Type size={12}/> Text</button>
                        <button onClick={onAddCamera} className="bg-[#222] hover:bg-[#333] py-2 rounded text-[10px] flex flex-col items-center text-gray-300"><Camera size={12}/> Cam</button>
                    </div>
                    
                    <input ref={fileInputOverlayRef} type="file" accept="video/*,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) { onAddLayer(f.type.startsWith('video')?'video':'image', f); e.target.value=''; } }} />
                    <input ref={fileInputBatchLayerRef} type="file" multiple accept="video/*,image/*" className="hidden" onChange={(e) => e.target.files && e.target.files.length > 0 && onBatchLayerUpload(Array.from(e.target.files) as File[])} />

                    <div className="space-y-1 pb-4">
                        {[...state.layers].reverse().map(l => (
                            <div key={l.id} onClick={(e) => { e.stopPropagation(); onSelectLayer(l.id); }} className={`p-2 rounded flex justify-between cursor-pointer ${state.selectedLayerId === l.id ? 'bg-blue-900' : 'bg-[#1a1a1a]'}`}>
                                <span className="text-[10px] truncate w-20">{l.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); onDeleteLayer(l.id); }} className="text-gray-500 hover:text-red-400"><Trash2 size={10}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* FOOTER: RESET BUTTON */}
            <div className="p-3 border-t border-[#2a2a2a] bg-[#151515]">
                <button 
                    onClick={onReset}
                    className="w-full bg-red-900/20 hover:bg-red-600 border border-red-900/50 hover:border-red-500 text-red-500 hover:text-white py-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 group"
                >
                    <RotateCcw size={14} className="group-hover:-rotate-180 transition-transform duration-500" />
                    RESET PROJECT
                </button>
            </div>
        </div>
    );
};
