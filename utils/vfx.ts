/// <reference lib="dom" />
import { VFXState } from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants";

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color?: string;
    alpha: number;
    life: number;
    maxLife: number;
    angle: number;      // Rotation angle
    angleSpeed: number; // Rotation speed
    phase: number;      // For wave motion
}

export class VFXSystem {
    particles: Particle[] = [];
    lastType: string = 'none';
    frame: number = 0;

    initParticles(type: string, count: number = 50) {
        this.particles = [];
        // Adjust count based on type for better performance/look
        let actualCount = count;
        if (type === 'rain') actualCount = 150;
        if (type === 'snow') actualCount = 80;
        if (type === 'fireflies') actualCount = 30;
        if (type === 'bubbles') actualCount = 40;
        if (type === 'confetti') actualCount = 80;
        if (type === 'embers') actualCount = 60;

        for (let i = 0; i < actualCount; i++) {
            this.particles.push(this.createParticle(type, true));
        }
    }

    createParticle(type: string, randomY: boolean = false): Particle {
        const x = Math.random() * CANVAS_WIDTH;
        // Start pos logic: falling things start top (or random), rising things start bottom
        let y = randomY ? Math.random() * CANVAS_HEIGHT : -20;
        if (['embers', 'bubbles'].includes(type)) {
            y = randomY ? Math.random() * CANVAS_HEIGHT : CANVAS_HEIGHT + 20;
        }
        
        let vx = 0, vy = 0, size = 1, life = 100, maxLife = 100;
        let angle = 0, angleSpeed = 0, phase = Math.random() * Math.PI * 2;
        let color: string | undefined = undefined;

        switch (type) {
            case 'rain':
                vx = 0; 
                vy = 20 + Math.random() * 15;
                size = 1 + Math.random(); // Thickness
                break;
            case 'snow':
                vx = (Math.random() - 0.5) * 1;
                vy = 1 + Math.random() * 2;
                size = 2 + Math.random() * 4;
                break;
            case 'embers':
                vx = (Math.random() - 0.5) * 1;
                vy = - (1 + Math.random() * 2);
                size = 2 + Math.random() * 4;
                life = 40 + Math.random() * 60;
                maxLife = life;
                break;
            case 'bubbles':
                vx = (Math.random() - 0.5) * 0.5;
                vy = - (1 + Math.random() * 2);
                size = 4 + Math.random() * 8;
                break;
            case 'fireflies':
                vx = (Math.random() - 0.5) * 2;
                vy = (Math.random() - 0.5) * 2;
                size = 2 + Math.random() * 3;
                break;
            case 'confetti':
                vx = (Math.random() - 0.5) * 2;
                vy = 3 + Math.random() * 4;
                size = 5 + Math.random() * 4;
                angle = Math.random() * 360;
                angleSpeed = (Math.random() - 0.5) * 15;
                const colors = ['#f43f5e', '#3b82f6', '#eab308', '#22c55e', '#a855f7', '#ec4899'];
                color = colors[Math.floor(Math.random() * colors.length)];
                break;
        }

        return { x, y, vx, vy, size, alpha: 1, life, maxLife, angle, angleSpeed, phase, color };
    }

    update(state: VFXState, ctx: CanvasRenderingContext2D) {
        this.frame++;
        
        if (state.type !== this.lastType) {
            this.lastType = state.type;
            this.particles = [];
        }

        if (state.type === 'none') return;

        // --- FULL SCREEN EFFECTS ---
        
        if (state.type === 'cinema') {
            ctx.fillStyle = '#000';
            const barHeight = CANVAS_HEIGHT * 0.12;
            ctx.fillRect(0, 0, CANVAS_WIDTH, barHeight);
            ctx.fillRect(0, CANVAS_HEIGHT - barHeight, CANVAS_WIDTH, barHeight);
            return;
        }

        if (state.type === 'tvnoise') {
            const w = CANVAS_WIDTH;
            const h = CANVAS_HEIGHT;
            // Static noise
            for (let i = 0; i < 20; i++) {
                 const x = Math.random() * w;
                 const y = Math.random() * h;
                 const sw = Math.random() * w;
                 const sh = 2 + Math.random() * 5;
                 ctx.fillStyle = `rgba(255, 255, 255, ${0.05 * state.opacity})`;
                 ctx.fillRect(x, y, sw, sh);
            }
            // Scanlines
            ctx.fillStyle = `rgba(0, 0, 0, ${0.1 * state.opacity})`;
            for(let y = 0; y < h; y += 4) {
                ctx.fillRect(0, y, w, 1);
            }
            // Chromatic aberration shift occasionally
            if (Math.random() > 0.92) {
                 ctx.save();
                 ctx.globalCompositeOperation = 'screen';
                 const shiftY = Math.random() * h;
                 const shiftH = Math.random() * 50;
                 ctx.fillStyle = `rgba(255,0,0, ${0.2 * state.opacity})`;
                 ctx.fillRect(Math.random()*10 - 5, shiftY, w, shiftH);
                 ctx.fillStyle = `rgba(0,255,0, ${0.2 * state.opacity})`;
                 ctx.fillRect(Math.random()*10 - 5, shiftY, w, shiftH);
                 ctx.restore();
            }
            return;
        }

        // --- PARTICLE EFFECTS ---

        if (this.particles.length === 0) {
            this.initParticles(state.type);
        }

        const windX = state.wind;

        this.particles.forEach((p, index) => {
            // General Movement
            let moveX = p.vx + (windX * 0.5); 
            let moveY = p.vy * state.speed;

            // Specific behaviors
            if (state.type === 'snow') {
                moveX += Math.sin(this.frame * 0.05 + p.phase) * 0.5;
            } else if (state.type === 'bubbles') {
                moveX += Math.sin(this.frame * 0.02 + p.phase) * 0.3;
            } else if (state.type === 'fireflies') {
                p.vx += (Math.random() - 0.5) * 0.1;
                p.vy += (Math.random() - 0.5) * 0.1;
                // constrain velocity
                p.vx = Math.max(-1.5, Math.min(1.5, p.vx));
                p.vy = Math.max(-1.5, Math.min(1.5, p.vy));
                moveX = p.vx;
                moveY = p.vy;
            } else if (state.type === 'confetti') {
                p.angle += p.angleSpeed * state.speed;
                moveX += Math.sin(this.frame * 0.1 + p.phase) * 1; // fluttering
            }

            p.x += moveX;
            p.y += moveY;

            // Life cycle
            if (state.type === 'embers') {
                p.life -= state.speed;
                p.alpha = Math.max(0, p.life / p.maxLife);
            } else if (state.type === 'fireflies') {
                // Pulse alpha
                p.alpha = 0.5 + Math.sin(this.frame * 0.05 + p.phase) * 0.5;
            }

            // Boundary checks & Respawn
            let respawn = false;
            // Falling items
            if (['rain', 'snow', 'confetti'].includes(state.type)) {
                if (p.y > CANVAS_HEIGHT + 20) respawn = true;
            }
            // Rising items
            if (['embers', 'bubbles'].includes(state.type)) {
                if (p.y < -20) respawn = true;
            }
            // Fireflies
            if (state.type === 'fireflies') {
                 if (p.x < -50 || p.x > CANVAS_WIDTH + 50 || p.y < -50 || p.y > CANVAS_HEIGHT + 50) respawn = true;
            }
            
            if (p.life <= 0) respawn = true;

            // X wrapping for some
            if (['snow', 'rain', 'confetti'].includes(state.type)) {
                if (p.x > CANVAS_WIDTH + 20) p.x = -20;
                if (p.x < -20) p.x = CANVAS_WIDTH + 20;
            }

            if (respawn) {
                const newP = this.createParticle(state.type);
                this.particles[index] = newP;
                // Position logic based on direction
                // If it was supposed to fall, put it at top
                if (['rain', 'snow', 'confetti'].includes(state.type)) {
                    this.particles[index].y = -20;
                    this.particles[index].x = Math.random() * CANVAS_WIDTH; 
                } else if (['embers', 'bubbles'].includes(state.type)) {
                    this.particles[index].y = CANVAS_HEIGHT + 20;
                    this.particles[index].x = Math.random() * CANVAS_WIDTH;
                }
            }
        });

        // Drawing
        this.particles.forEach(p => {
             ctx.save();
             ctx.globalAlpha = p.alpha * state.opacity;
             
             if (state.type === 'rain') {
                 ctx.strokeStyle = `rgba(174, 194, 224, 0.6)`;
                 ctx.lineWidth = p.size;
                 ctx.beginPath();
                 ctx.moveTo(p.x, p.y);
                 // Rain angle
                 const len = 25 * state.speed;
                 const slant = windX * 2;
                 ctx.lineTo(p.x + slant, p.y + len);
                 ctx.stroke();

             } else if (state.type === 'snow') {
                 // Soft snow
                 const radius = p.size * state.size;
                 const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
                 grad.addColorStop(0, 'rgba(255,255,255,0.9)');
                 grad.addColorStop(1, 'rgba(255,255,255,0)');
                 ctx.fillStyle = grad;
                 ctx.beginPath();
                 ctx.arc(p.x, p.y, radius, 0, Math.PI*2);
                 ctx.fill();

             } else if (state.type === 'embers') {
                 // Orange/Red glow
                 const hue = 10 + Math.random() * 30; // Orange/Yellow
                 ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${p.alpha})`;
                 ctx.shadowBlur = 10 * state.size;
                 ctx.shadowColor = `hsla(${hue}, 100%, 50%, 1)`;
                 ctx.beginPath();
                 ctx.arc(p.x, p.y, p.size * state.size, 0, Math.PI*2);
                 ctx.fill();
                 ctx.shadowBlur = 0;

             } else if (state.type === 'fireflies') {
                 ctx.fillStyle = '#ccff00';
                 ctx.shadowBlur = 6 * state.size;
                 ctx.shadowColor = '#aaff00';
                 ctx.beginPath();
                 ctx.arc(p.x, p.y, p.size * state.size, 0, Math.PI*2);
                 ctx.fill();
                 ctx.shadowBlur = 0;

             } else if (state.type === 'bubbles') {
                 ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                 ctx.lineWidth = 1.5;
                 ctx.beginPath();
                 const r = p.size * state.size;
                 ctx.arc(p.x, p.y, r, 0, Math.PI*2);
                 ctx.stroke();
                 // shine
                 ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                 ctx.beginPath();
                 ctx.arc(p.x - r*0.3, p.y - r*0.3, r*0.25, 0, Math.PI*2);
                 ctx.fill();

             } else if (state.type === 'confetti') {
                 ctx.fillStyle = p.color || state.color;
                 ctx.translate(p.x, p.y);
                 ctx.rotate(p.angle * Math.PI / 180);
                 // Simulate 3D flip by scaling Y based on rotation
                 const scaleY = Math.abs(Math.cos(p.angle * 0.05));
                 const w = p.size * state.size;
                 const h = (p.size * 0.6) * state.size;
                 ctx.fillRect(-w/2, (-h/2) * scaleY, w, h * scaleY);
             }

             ctx.restore();
        });
    }
}