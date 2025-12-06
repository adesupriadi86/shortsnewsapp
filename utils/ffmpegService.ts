
/// <reference lib="dom" />

// We remove the dependency on the global UMD script tags for the logic, 
// using dynamic imports for better compatibility with modern browser workers.

const loadFFmpeg = async () => {
    const { FFmpeg } = await import("https://esm.sh/@ffmpeg/ffmpeg@0.12.10");
    const { toBlobURL, fetchFile } = await import("https://esm.sh/@ffmpeg/util@0.12.1");
    const ffmpeg = new FFmpeg();
    
    // Load Core explicitly
    const coreVersion = '0.12.10';
    const coreBaseURL = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/umd`;
    
    const coreURL = await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm');

    await ffmpeg.load({
        coreURL: coreURL,
        wasmURL: wasmURL,
    });
    
    return { ffmpeg, fetchFile };
};

export const convertWebmToMp4 = async (webmBlob: Blob): Promise<Blob> => {
  console.log("🎬 Starting FFmpeg Conversion...");

  try {
    const { ffmpeg, fetchFile } = await loadFFmpeg();

    ffmpeg.on('log', ({ message }: any) => console.log('FFmpeg:', message));

    console.log("✅ Engine Ready. Writing file...");
    await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

    console.log("⚙️ Converting to MP4...");
    await ffmpeg.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28', 
      '-c:a', 'aac',
      '-movflags', '+faststart',
      '-y',
      'output.mp4'
    ]);

    const data = await ffmpeg.readFile('output.mp4');
    const mp4Blob = new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' });
    
    return mp4Blob;

  } catch (error: any) {
    console.error("❌ Conversion Error:", error);
    if (error.message && error.message.includes('814')) {
        throw new Error("Gagal memuat modul FFmpeg. Coba refresh halaman.");
    }
    throw new Error("Gagal konversi video: " + (error.message || "Unknown error"));
  }
};

export interface VideoSegment {
    start: number;
    duration: number;
    index: number;
}

export const splitVideo = async (inputFile: File, segments: VideoSegment[], onProgress: (msg: string) => void): Promise<File[]> => {
    try {
        onProgress("Memuat FFmpeg Engine...");
        const { ffmpeg, fetchFile } = await loadFFmpeg();
        
        onProgress("Membaca file video sumber...");
        // Use a generic name but keep extension to help ffmpeg detect format
        const ext = inputFile.name.split('.').pop() || 'mp4';
        const inputName = `source.${ext}`;
        await ffmpeg.writeFile(inputName, await fetchFile(inputFile));

        const outputFiles: File[] = [];

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const outName = `clip_${i+1}.mp4`;
            
            onProgress(`Memproses Video ${i+1}/${segments.length} (${seg.duration.toFixed(1)}s)...`);
            
            // FFmpeg command to slice
            // -ss: Start time
            // -t: Duration
            // -c:v libx264 -preset ultrafast: Re-encode fast to ensure frame accuracy (copy can be buggy for precise cuts)
            await ffmpeg.exec([
                '-ss', seg.start.toString(),
                '-i', inputName,
                '-t', seg.duration.toString(),
                '-c:v', 'libx264', '-preset', 'ultrafast', // Fast re-encode
                '-c:a', 'aac', // Ensure audio is compatible
                '-y',
                outName
            ]);

            const data = await ffmpeg.readFile(outName);
            const blob = new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' });
            const file = new File([blob], `split_${i+1}_${inputFile.name}.mp4`, { type: 'video/mp4' });
            outputFiles.push(file);
            
            // Cleanup output file from memory
            await ffmpeg.deleteFile(outName);
        }

        return outputFiles;

    } catch (error: any) {
        console.error("Split Error:", error);
        throw new Error("Gagal memotong video: " + error.message);
    }
};
