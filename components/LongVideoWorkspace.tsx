
import React, { useState, useRef, useEffect } from 'react';
import { X, Film, UploadCloud, Clock, Scissors, Play, AlertCircle, Loader2, CheckCircle2, Layers } from 'lucide-react';

interface Props {
    onClose: () => void;
    onApply: (files: File[]) => void;
}

interface VideoSegment {
    start: number;
    duration: number;
    index: number;
}

export const LongVideoWorkspace: React.FC<Props> = ({ onClose, onApply }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    
    // NEW SETTINGS
    const [minDuration, setMinDuration] = useState<number>(3.1);
    const [maxDuration, setMaxDuration] = useState<number>(5.1);
    const [videoCount, setVideoCount] = useState<number>(2);

    const [isProcessing, setIsProcessing] = useState(false);
    const [progressMsg, setProgressMsg] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [videoMeta, setVideoMeta] = useState<{ duration: number, format: string } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            // Load metadata
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                setVideoMeta({ duration: video.duration, format: file.type });
            };
            video.src = URL.createObjectURL(file);
        }
    };

    // Helper to format float to fixed 1
    const f1 = (n: number) => parseFloat(n.toFixed(1));

    // --- NATIVE RECORDING METHOD ---
    const recordSegments = async (sourceFile: File, segments: VideoSegment[]): Promise<File[]> => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(sourceFile);
            video.crossOrigin = "anonymous";
            
            // PENTING: Muted = false agar audio terekam.
            // Volume = 0 agar tidak berisik saat proses (semoga browser tetap merekam track audio)
            // Note: Beberapa browser merekam silence jika volume 0. Kita set 0.05 (sangat kecil)
            video.muted = false;
            video.volume = 0.05; 
            video.preload = "auto";
            
            video.onerror = () => reject(new Error("Gagal memuat video source."));

            video.onloadedmetadata = async () => {
                let stream: MediaStream;
                try {
                    // @ts-ignore
                    stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
                } catch (e) {
                    reject(new Error("Browser tidak mendukung captureStream."));
                    return;
                }

                const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
                    ? 'video/webm;codecs=vp9' 
                    : 'video/webm';
                
                const mediaRecorder = new MediaRecorder(stream, { mimeType });
                const results: File[] = [];
                let currentIdx = 0;

                const processNext = async () => {
                    if (currentIdx >= segments.length) {
                        resolve(results);
                        return;
                    }

                    const seg = segments[currentIdx];
                    setProgressMsg(`Merekam Klip ${currentIdx + 1}/${segments.length} (${seg.duration.toFixed(1)}s)...`);
                    
                    // 1. Seek to start
                    video.currentTime = seg.start;
                    
                    // 2. Wait for seek
                    await new Promise(r => { 
                        const h = () => { video.removeEventListener('seeked', h); r(null); };
                        video.addEventListener('seeked', h);
                    });

                    // 3. Setup Recorder
                    const chunks: Blob[] = [];
                    const onData = (e: BlobEvent) => { if (e.data.size > 0) chunks.push(e.data); };
                    mediaRecorder.ondataavailable = onData;
                    
                    mediaRecorder.onstop = () => {
                         const blob = new Blob(chunks, { type: 'video/webm' });
                         // Create file in memory
                         const f = new File([blob], `clip_${currentIdx+1}_${Date.now()}.webm`, { type: 'video/webm' });
                         results.push(f);
                         
                         // Cleanup listeners
                         mediaRecorder.ondataavailable = null;
                         mediaRecorder.onstop = null;
                         
                         currentIdx++;
                         processNext(); // Rekursif ke segmen berikutnya
                    };

                    // 4. Start Recording & Playing
                    mediaRecorder.start();
                    try {
                        await video.play();
                    } catch(e) {
                        reject(new Error("Autoplay diblokir. Silakan berinteraksi dengan halaman."));
                        return;
                    }

                    // 5. Stop after duration
                    setTimeout(() => {
                        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
                        video.pause();
                    }, seg.duration * 1000);
                };

                // Start Loop
                processNext();
            };
        });
    };

    const handleApply = async () => {
        if (!selectedFile || !videoMeta) return;
        
        // 1. Generate Split Plan (Sequential)
        const segments: VideoSegment[] = [];
        let cursorTime = 0;

        for (let i = 0; i < videoCount; i++) {
            const dur = f1(Math.random() * (maxDuration - minDuration) + minDuration);
            
            if (cursorTime + dur > videoMeta.duration) {
                alert(`Durasi video asli tidak cukup untuk memotong ${videoCount} video. Hanya bisa sampai video ke-${i}.`);
                break;
            }

            segments.push({
                index: i,
                start: f1(cursorTime),
                duration: dur
            });

            cursorTime += dur;
        }

        if (segments.length === 0) return;

        setIsProcessing(true);
        setProgressMsg('Menyiapkan Engine Recording...');

        try {
            // Gunakan metode Record, bukan FFmpeg
            const resultFiles = await recordSegments(selectedFile, segments);
            onApply(resultFiles);
        } catch (e: any) {
            alert("Error: " + e.message);
            setIsProcessing(false);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const avgDur = (minDuration + maxDuration) / 2;
    const totalNeeded = avgDur * videoCount;
    const isEnough = videoMeta ? videoMeta.duration >= totalNeeded : true;

    return (
        <div className="fixed inset-0 z-[200] bg-[#0f0f0f]/95 text-white flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in zoom-in-95">
            <div className="bg-[#181818] w-full max-w-2xl rounded-2xl border border-[#333] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="h-16 border-b border-[#2a2a2a] bg-[#121212] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <Scissors className="text-orange-500" />
                        <div>
                            <h1 className="text-lg font-bold tracking-wide">Long Video Splitter</h1>
                            <p className="text-[10px] text-gray-500">Auto-Record Short Clips (No Download)</p>
                        </div>
                    </div>
                    {!isProcessing && (
                        <button onClick={onClose} className="p-2 hover:bg-[#2a2a2a] rounded-full transition text-gray-400 hover:text-white">
                            <X />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    
                    {!selectedFile ? (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-[#333] hover:border-orange-500 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition bg-[#1a1a1a] hover:bg-[#202020] group h-64"
                        >
                            <div className="w-16 h-16 bg-[#252525] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition">
                                <UploadCloud size={32} className="text-gray-400 group-hover:text-orange-500" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-300 mb-2">Upload Long Video</h3>
                            <p className="text-xs text-gray-500">MP4, WEBM, MOV</p>
                            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Video Preview Info */}
                            <div className="bg-[#202020] rounded-xl p-4 border border-[#333] flex gap-4">
                                <div className="w-32 h-20 bg-black rounded-lg flex items-center justify-center relative overflow-hidden">
                                     <Film size={24} className="text-gray-600" />
                                     <video src={URL.createObjectURL(selectedFile)} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-sm text-gray-200 mb-1 truncate">{selectedFile.name}</h3>
                                    <div className="flex gap-4 text-xs text-gray-500 font-mono mt-2">
                                        <span className="flex items-center gap-1"><Clock size={10} /> {videoMeta ? formatTime(videoMeta.duration) : '--:--'}</span>
                                        <span className="flex items-center gap-1"><UploadCloud size={10} /> {(selectedFile.size / (1024*1024)).toFixed(1)} MB</span>
                                    </div>
                                    {!isProcessing && (
                                        <button 
                                            onClick={() => setSelectedFile(null)} 
                                            className="text-[10px] text-red-400 hover:text-red-300 mt-2 hover:underline"
                                        >
                                            Ganti File
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Auto Split Settings */}
                            <div className="bg-[#202020] rounded-xl p-6 border border-[#333] relative overflow-hidden">
                                {isProcessing && (
                                    <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center text-center p-4">
                                        <Loader2 size={32} className="text-orange-500 animate-spin mb-4" />
                                        <h3 className="text-lg font-bold text-white mb-1">Merekam Klip...</h3>
                                        <p className="text-xs text-gray-400">{progressMsg}</p>
                                        <p className="text-[10px] text-gray-600 mt-2 max-w-xs">Mohon tunggu, video sedang diputar dan direkam di latar belakang...</p>
                                    </div>
                                )}

                                <h4 className="text-sm font-bold text-orange-400 mb-6 flex items-center gap-2 border-b border-[#333] pb-2">
                                    <Layers size={14} /> KONFIGURASI POTONGAN OTOMATIS
                                </h4>
                                
                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    {/* Range Duration */}
                                    <div className="col-span-2 md:col-span-1 space-y-4">
                                        <label className="text-xs font-bold text-gray-300 block">DURASI PER POTONGAN (Detik)</label>
                                        
                                        <div>
                                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                <span>Min: {minDuration}s</span>
                                            </div>
                                            <input 
                                                type="number" step="0.1" min="1" max={maxDuration}
                                                value={minDuration} 
                                                onChange={(e) => setMinDuration(parseFloat(e.target.value))}
                                                className="w-full bg-[#151515] border border-[#404040] rounded px-3 py-2 text-sm text-white focus:border-orange-500 outline-none"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                <span>Max: {maxDuration}s</span>
                                            </div>
                                            <input 
                                                type="number" step="0.1" min={minDuration} max="60"
                                                value={maxDuration} 
                                                onChange={(e) => setMaxDuration(parseFloat(e.target.value))}
                                                className="w-full bg-[#151515] border border-[#404040] rounded px-3 py-2 text-sm text-white focus:border-orange-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Count */}
                                    <div className="col-span-2 md:col-span-1 space-y-4">
                                        <label className="text-xs font-bold text-gray-300 block">JUMLAH VIDEO BACKGROUND</label>
                                        <div className="bg-[#151515] p-4 rounded border border-[#333] flex flex-col items-center justify-center h-[108px]">
                                            <div className="flex items-center gap-4">
                                                <button onClick={() => setVideoCount(Math.max(1, videoCount - 1))} className="w-8 h-8 rounded bg-[#333] hover:bg-[#444] text-white font-bold">-</button>
                                                <span className="text-3xl font-bold text-orange-400 font-mono">{videoCount}</span>
                                                <button onClick={() => setVideoCount(videoCount + 1)} className="w-8 h-8 rounded bg-[#333] hover:bg-[#444] text-white font-bold">+</button>
                                            </div>
                                            <span className="text-[9px] text-gray-500 mt-2">Potongan Video</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Projection Info */}
                                <div className={`p-3 rounded-lg flex items-start gap-3 border transition ${isEnough ? 'bg-blue-900/10 border-blue-900/30' : 'bg-red-900/10 border-red-900/30'}`}>
                                    {isEnough ? <CheckCircle2 size={16} className="text-blue-400 mt-0.5" /> : <AlertCircle size={16} className="text-red-400 mt-0.5" />}
                                    <div className="text-xs">
                                        <p className={`font-bold mb-1 ${isEnough ? 'text-blue-200' : 'text-red-300'}`}>
                                            {isEnough ? 'Estimasi Cukup' : 'Durasi Tidak Cukup!'}
                                        </p>
                                        <p className="text-gray-400 leading-relaxed">
                                            Aplikasi akan <span className="text-white font-bold">merekam ~{totalNeeded.toFixed(1)} detik</span> footage dari video asli ({videoMeta ? videoMeta.duration.toFixed(1) : 0}s).
                                            <br/>Potongan diambil secara <span className="text-orange-300">berurutan (sequential)</span> langsung ke Canvas.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-[#2a2a2a] bg-[#121212] flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-6 py-3 rounded-xl bg-[#222] hover:bg-[#333] text-gray-300 font-bold text-xs transition disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button 
                        onClick={handleApply}
                        disabled={!selectedFile || isProcessing || !isEnough}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold text-xs transition shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
                        {isProcessing ? 'SEDANG MEREKAM...' : `RECORD & SPLIT (${videoCount})`}
                    </button>
                </div>

            </div>
        </div>
    );
};
