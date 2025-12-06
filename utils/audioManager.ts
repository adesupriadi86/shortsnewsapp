/// <reference lib="dom" />

export class AudioManager {
    ctx: AudioContext;
    dest: MediaStreamAudioDestinationNode;
    gainVideo: GainNode;
    gainMusic: GainNode;
    gainLayer: GainNode;
    sourceVideo: MediaElementAudioSourceNode | null = null;
    sourceMusic: AudioBufferSourceNode | null = null;
    layerSources = new Map<HTMLVideoElement, MediaElementAudioSourceNode>();
    musicBuffer: AudioBuffer | null = null;
    musicStartTime: number = 0;
    musicPauseTime: number = 0;

    constructor() {
        const Win = window as any;
        this.ctx = new (Win.AudioContext || Win.webkitAudioContext)();
        this.dest = this.ctx.createMediaStreamDestination();
        
        // Background Video Gain
        this.gainVideo = this.ctx.createGain();
        this.gainVideo.connect(this.dest);
        this.gainVideo.connect(this.ctx.destination); // Connect to speakers too so user hears it
        
        // Music Gain
        this.gainMusic = this.ctx.createGain();
        this.gainMusic.connect(this.dest);
        this.gainMusic.connect(this.ctx.destination);

        // Layer Video Gain
        this.gainLayer = this.ctx.createGain();
        this.gainLayer.connect(this.dest);
        this.gainLayer.connect(this.ctx.destination);
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                console.log("AudioContext Resumed");
            });
        }
    }

    connectVideo(videoElement: HTMLVideoElement) {
        if (this.sourceVideo) return; 
        try {
            // NOTE: Video element must NOT be muted in DOM property, otherwise SourceNode is silent
            this.sourceVideo = this.ctx.createMediaElementSource(videoElement);
            this.sourceVideo.connect(this.gainVideo);
            console.log("Connected BG Video to AudioContext");
        } catch (e) {
            console.warn("Audio node likely already connected:", e);
        }
    }

    connectLayer(videoElement: HTMLVideoElement) {
        if (this.layerSources.has(videoElement)) return;
        try {
            const source = this.ctx.createMediaElementSource(videoElement);
            source.connect(this.gainLayer);
            this.layerSources.set(videoElement, source);
            console.log("Connected Layer Video to AudioContext");
        } catch (e) {
            console.warn("Could not connect layer audio:", e);
        }
    }

    async loadMusic(arrayBuffer: ArrayBuffer): Promise<number> {
        try {
            const decoded = await this.ctx.decodeAudioData(arrayBuffer);
            this.musicBuffer = decoded;
            return decoded.duration;
        } catch (e) {
            console.error("Audio Decode Error:", e);
            throw new Error("Format audio tidak didukung atau file rusak.");
        }
    }

    playMusic(offset: number, duration: number, loop: boolean = true) {
        if (!this.musicBuffer) return;
        this.stopMusic();

        this.sourceMusic = this.ctx.createBufferSource();
        this.sourceMusic.buffer = this.musicBuffer;
        this.sourceMusic.loop = loop;
        
        if (duration < this.musicBuffer.duration) {
            this.sourceMusic.loopStart = offset;
            this.sourceMusic.loopEnd = offset + duration;
        }

        this.sourceMusic.connect(this.gainMusic);
        
        const playPos = offset + this.musicPauseTime;
        const startPos = (playPos >= (offset + duration)) ? offset : playPos;

        this.sourceMusic.start(0, startPos);
        this.musicStartTime = this.ctx.currentTime - this.musicPauseTime;
    }

    stopMusic() {
        if (this.sourceMusic) {
            try {
                this.sourceMusic.stop();
                this.sourceMusic.disconnect();
            } catch (e) { /* ignore */ }
            this.sourceMusic = null;
        }
    }

    resetMusicTime() {
        this.musicPauseTime = 0;
    }

    setVolumes(videoVol: number, musicVol: number, layerVol: number) {
        this.gainVideo.gain.value = videoVol;
        this.gainMusic.gain.value = musicVol;
        this.gainLayer.gain.value = layerVol;
    }
    
    reset() {
        this.stopMusic();
        this.resetMusicTime();
        
        this.layerSources.forEach((source) => {
            try { source.disconnect(); } catch(e) {}
        });
        this.layerSources.clear();
        
        if (this.sourceVideo) {
            // Note: MediaElementSource cannot be formally 'disconnected' from element, 
            // but we can disconnect graph output. 
            // Often cleaner to just reset gain or assume page reload for full reset.
        }
        
        this.gainVideo.gain.value = 1.0;
        this.gainMusic.gain.value = 0.5;
        this.gainLayer.gain.value = 1.0;
    }
    
    close() {
        try {
            this.stopMusic();
            this.ctx.close();
        } catch (e) {
            console.error("Error closing AudioContext", e);
        }
    }
    
    getStream() {
        return this.dest.stream;
    }
}