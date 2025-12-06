
/// <reference lib="dom" />
import React, { useRef, useState, useEffect } from 'react';
import { X, Circle, RotateCcw, Check, Loader2 } from 'lucide-react';

interface Props {
    onClose: () => void;
    onSave: (file: File) => void;
}

export const CameraRecorder: React.FC<Props> = ({ onClose, onSave }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [timer, setTimer] = useState(0);
    const timerRef = useRef<number>(0);
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, []);

    const startCamera = async () => {
        setIsLoading(true);
        setError('');
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Browser tidak mendukung akses kamera.");
            }
            const s = await navigator.mediaDevices.getUserMedia({ 
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, 
                audio: true 
            });
            setStream(s);
            if (videoRef.current) {
                videoRef.current.srcObject = s;
                videoRef.current.muted = true; // Mute preview
                videoRef.current.play();
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Gagal mengakses kamera. Periksa izin.");
        } finally {
            setIsLoading(false);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
        }
    };

    const handleStartRecording = () => {
        if (!stream) return;
        
        try {
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                setRecordedBlob(blob);
                if (videoRef.current) {
                    videoRef.current.srcObject = null;
                    videoRef.current.src = URL.createObjectURL(blob);
                    videoRef.current.muted = false;
                    videoRef.current.loop = true;
                    videoRef.current.play();
                }
            };
            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            
            setTimer(0);
            timerRef.current = window.setInterval(() => setTimer(t => t + 1), 1000);
        } catch (e: any) {
            console.error(e);
            setError("Gagal memulai perekaman: " + e.message);
        }
    };

    const handleStopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        clearInterval(timerRef.current);
    };

    const handleRetake = () => {
        setRecordedBlob(null);
        if (videoRef.current && stream) {
            videoRef.current.src = "";
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            videoRef.current.play();
        }
        setError('');
    };

    const handleConfirm = () => {
        if (recordedBlob) {
            const file = new File([recordedBlob], `cam-recording-${Date.now()}.webm`, { type: 'video/webm' });
            onSave(file);
        }
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#181818] border border-gray-700 rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl flex flex-col h-[80vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-4 bg-[#202020] border-b border-gray-800 shrink-0">
                    <h3 className="text-white font-bold flex items-center gap-2 text-sm">
                        <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></span>
                        CAMERA RECORDER
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
                </div>

                {/* Viewport */}
                <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                    {error ? (
                        <div className="text-center p-6">
                            <p className="text-red-500 mb-2 font-bold text-sm">Error Kamera</p>
                            <p className="text-gray-400 text-xs">{error}</p>
                            <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-800 rounded text-xs hover:bg-gray-700 border border-gray-600">Tutup</button>
                        </div>
                    ) : (
                        <>
                            {isLoading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-gray-500 gap-2">
                                    <Loader2 className="animate-spin" />
                                    <span className="text-xs">Accessing Camera...</span>
                                </div>
                            )}
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                className="w-full h-full object-contain"
                            />
                        </>
                    )}
                    
                    {/* Recording Overlay */}
                    {isRecording && (
                        <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-2 shadow-lg animate-pulse z-20">
                            <Circle size={8} fill="currentColor" /> REC {formatTime(timer)}
                        </div>
                    )}
                </div>

                {/* Controls - Guaranteed visibility with shrink-0 and proper padding */}
                <div className="p-4 flex items-center justify-center gap-6 bg-[#202020] border-t border-gray-800 shrink-0 min-h-[100px]">
                    {!error && !isLoading && (
                        !recordedBlob ? (
                            !isRecording ? (
                                <button 
                                    onClick={handleStartRecording}
                                    disabled={!stream}
                                    className="w-14 h-14 rounded-full border-4 border-white flex items-center justify-center bg-red-600 hover:bg-red-500 transition shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed group"
                                    title="Start Recording"
                                >
                                    <div className="w-5 h-5 bg-white rounded-full group-disabled:bg-gray-300"></div>
                                </button>
                            ) : (
                                <button 
                                    onClick={handleStopRecording}
                                    className="w-14 h-14 rounded-full border-4 border-white flex items-center justify-center bg-transparent hover:bg-white/10 transition"
                                    title="Stop Recording"
                                >
                                    <div className="w-5 h-5 bg-red-500 rounded-sm"></div>
                                </button>
                            )
                        ) : (
                            <>
                                <button 
                                    onClick={handleRetake}
                                    className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"
                                >
                                    <div className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 border border-gray-600"><RotateCcw size={18} /></div>
                                    <span className="text-[10px]">Retake</span>
                                </button>

                                <button 
                                    onClick={handleConfirm}
                                    className="flex flex-col items-center gap-1 text-green-400 hover:text-green-300 transition"
                                >
                                    <div className="p-3 rounded-full bg-green-900/50 border border-green-500 hover:bg-green-900"><Check size={22} /></div>
                                    <span className="text-[10px] font-bold">Use Video</span>
                                </button>
                            </>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
