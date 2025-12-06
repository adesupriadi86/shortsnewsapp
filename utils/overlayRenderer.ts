
/// <reference lib="dom" />
import { OverlayState } from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants";

// Helper for rounded rects
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawOverlay(ctx: CanvasRenderingContext2D, state: OverlayState) {
    if (!state || state.type === 'none') return;

    // Center Anchor X, but allow Y offset
    // Base coordinates are relative to center
    const cx = CANVAS_WIDTH / 2 + (state.x || 0);
    const cy = CANVAS_HEIGHT / 2 + (state.y || 0);
    
    // Animation Pulse
    const now = Date.now();
    const pulse = 1 + Math.sin(now * 0.005) * 0.03; // Subtle breath
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(state.scale * pulse, state.scale * pulse);
    
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    if (state.type === 'subscribe') {
        // Red Box
        ctx.fillStyle = '#FF0000';
        const w = 240;
        const h = 70;
        roundRect(ctx, -w/2, -h/2, w, h, 15);
        ctx.fill();

        // Text
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Play Icon (Triangle)
        ctx.beginPath();
        const tx = -80;
        ctx.moveTo(tx, -10);
        ctx.lineTo(tx + 20, 0);
        ctx.lineTo(tx, 10);
        ctx.fill();

        ctx.fillText("SUBSCRIBE", 15, 2);

    } else if (state.type === 'like') {
        // Blue Circle/Pill
        ctx.fillStyle = '#3b82f6';
        const w = 180;
        const h = 70;
        roundRect(ctx, -w/2, -h/2, w, h, 35);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Using Emoji for simple icon rendering without external assets
        ctx.fillText("👍 LIKE", 0, 2);

    } else if (state.type === 'follow') {
        // Black/Dark Pill
        ctx.fillStyle = '#111';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        const w = 200;
        const h = 70;
        roundRect(ctx, -w/2, -h/2, w, h, 35);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("➕ FOLLOW", 0, 2);
    }

    ctx.restore();
}
