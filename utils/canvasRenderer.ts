/// <reference lib="dom" />
import { Layer, BGConfig } from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants";

// Helper to wrap text based on max width
function getWrappedLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const rawLines = text.split('\n');
    const wrappedLines: string[] = [];

    rawLines.forEach(line => {
        const words = line.split(' ');
        let currentLine = words[0] || '';

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                wrappedLines.push(currentLine);
                currentLine = word;
            }
        }
        wrappedLines.push(currentLine);
    });

    return wrappedLines;
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  config: BGConfig,
  videoElement: HTMLVideoElement,
  imageElement: HTMLImageElement | null
) {
  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2 + config.x, CANVAS_HEIGHT / 2 + config.y);
  ctx.scale(config.scale, config.scale);

  if (config.blur > 0) {
    ctx.filter = `blur(${config.blur}px)`;
  }

  if (config.type === 'video' && videoElement) {
    if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
        ctx.drawImage(
            videoElement,
            -videoElement.videoWidth / 2,
            -videoElement.videoHeight / 2,
            videoElement.videoWidth,
            videoElement.videoHeight
        );
    }
  } else if (config.type === 'image' && imageElement) {
    ctx.drawImage(
        imageElement,
        -imageElement.width / 2,
        -imageElement.height / 2,
        imageElement.width,
        imageElement.height
    );
  } else {
     ctx.filter = 'none';
     ctx.fillStyle = '#111';
     ctx.fillRect(-CANVAS_WIDTH/2, -CANVAS_HEIGHT/2, CANVAS_WIDTH, CANVAS_HEIGHT);
     ctx.fillStyle = '#333';
     ctx.textAlign = 'center';
     ctx.font = 'bold 40px Arial';
     ctx.fillText("NO MEDIA", 0, 0);
  }

  ctx.restore();
}

export function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  isSelected: boolean
) {
  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(layer.scale, layer.scale);

  if (layer.type === 'image' || layer.type === 'video') {
    if (layer.element) {
        // Safe check if video element is ready
        if (layer.element instanceof HTMLVideoElement) {
             if (layer.element.readyState < 2) {
                 // skip
             } else {
                 ctx.drawImage(
                    layer.element,
                    -layer.width / 2,
                    -layer.height / 2,
                    layer.width,
                    layer.height
                );
             }
        } else if (layer.element instanceof HTMLImageElement) {
             ctx.drawImage(
                layer.element,
                -layer.width / 2,
                -layer.height / 2,
                layer.width,
                layer.height
            );
        }
    } else {
        // Placeholder
        ctx.fillStyle = '#333';
        ctx.fillRect(-layer.width/2, -layer.height/2, layer.width, layer.height);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '12px Arial';
        ctx.fillText(layer.name, 0, 0);
    }
    
    if (isSelected) {
      drawSelectionBox(ctx, layer.width, layer.height);
    }
  } else if (layer.type === 'text') {
    const fontStr = `${layer.italic ? 'italic' : ''} ${layer.bold ? 'bold' : ''} ${layer.fontSize || 60}px "${layer.fontFamily || 'Arial'}"`;
    ctx.font = fontStr;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';

    // Automatic Word Wrapping logic
    const maxWidth = layer.width || CANVAS_WIDTH * 0.8; // Default to 80% canvas width if undefined
    const lines = getWrappedLines(ctx, layer.content || '', maxWidth);

    const lineHeight = (layer.fontSize || 60) * 1.2;
    const totalHeight = lines.length * lineHeight;
    const padding = layer.padding || 10;

    // Background
    if (!layer.bgTransparent) {
        // Find widest line for bg width
        let maxLineWidth = 0;
        lines.forEach(line => {
             const w = ctx.measureText(line).width + (layer.outlineWidth || 0);
             if (w > maxLineWidth) maxLineWidth = w;
        });
        
        ctx.fillStyle = layer.bgColor || '#000000';
        ctx.fillRect(
            (-maxLineWidth / 2) - padding,
            (-totalHeight / 2) - padding,
            maxLineWidth + (padding * 2),
            totalHeight + (padding * 2)
        );
    }

    // Outline
    if ((layer.outlineWidth || 0) > 0) {
        ctx.strokeStyle = layer.outlineColor || '#000000';
        ctx.lineWidth = layer.outlineWidth || 0;
        lines.forEach((line, i) => {
             ctx.strokeText(line, 0, (i * lineHeight) - (totalHeight / 2) + (lineHeight / 2));
        });
    }

    // Text Fill
    ctx.fillStyle = layer.color || '#ffffff';
    lines.forEach((line, i) => {
        ctx.fillText(line, 0, (i * lineHeight) - (totalHeight / 2) + (lineHeight / 2));
    });

    // Selection Box matches the actual text block size
    if (isSelected) {
        let maxLineWidth = 0;
        lines.forEach(line => {
             const w = ctx.measureText(line).width;
             if (w > maxLineWidth) maxLineWidth = w;
        });
        // Ensure box is at least layer.width wide if user is resizing it manually
        const boxWidth = Math.max(maxLineWidth + padding * 2, layer.width);
        drawSelectionBox(ctx, boxWidth + 10, totalHeight + padding * 2 + 10);
    }
  }

  ctx.restore();
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  
  const handleSize = 8;
  ctx.fillStyle = '#3b82f6';
  
  // Corners
  ctx.fillRect(-w / 2 - handleSize/2, -h / 2 - handleSize/2, handleSize, handleSize);
  ctx.fillRect(w / 2 - handleSize/2, -h / 2 - handleSize/2, handleSize, handleSize);
  ctx.fillRect(w / 2 - handleSize/2, h / 2 - handleSize/2, handleSize, handleSize);
  ctx.fillRect(-w / 2 - handleSize/2, h / 2 - handleSize/2, handleSize, handleSize);
}
