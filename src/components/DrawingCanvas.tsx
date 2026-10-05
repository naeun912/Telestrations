import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Pencil, 
  Eraser, 
  PaintBucket, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  Square, 
  Circle as CircleIcon, 
  Minus, 
  Grid
} from 'lucide-react';
import { soundFx } from '../utils/sound';

type Tool = 'pencil' | 'eraser' | 'fill' | 'line' | 'rectangle' | 'circle';

interface DrawingCanvasProps {
  onCanvasChange?: (dataUrl: string) => void;
  disabled?: boolean;
  initialDataUrl?: string;
}

const PRESET_COLORS = [
  '#000000', '#555555', '#888888', '#ffffff',
  '#e63946', '#f4a261', '#e9c46a', '#2a9d8f',
  '#264653', '#457b9d', '#6a0572', '#b5179e',
  '#7f5539', '#fb8500', '#00b4d8', '#38b000'
];

const STROKE_SIZES = [3, 8, 16, 28];

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  onCanvasChange,
  disabled = false,
  initialDataUrl
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState<string>('#000000');
  const [lineWidth, setLineWidth] = useState<number>(8);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Undo / Redo history stacks
  const historyRef = useRef<ImageData[]>([]);
  const historyStepRef = useRef<number>(-1);

  const isDrawingRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const snapshotRef = useRef<ImageData | null>(null);

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set high resolution crisp canvas internal size
    canvas.width = 600;
    canvas.height = 450;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // White background fill
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        saveHistory();
      };
      img.src = initialDataUrl;
    } else {
      saveHistory();
    }
  }, []);

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Truncate redo stack
    historyRef.current = historyRef.current.slice(0, historyStepRef.current + 1);
    historyRef.current.push(imageData);
    historyStepRef.current = historyRef.current.length - 1;

    if (onCanvasChange) {
      onCanvasChange(canvas.toDataURL('image/png'));
    }
  }, [onCanvasChange]);

  const undo = () => {
    if (historyStepRef.current > 0) {
      historyStepRef.current -= 1;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.putImageData(historyRef.current[historyStepRef.current], 0, 0);
      soundFx.playClick();
      if (onCanvasChange) onCanvasChange(canvas.toDataURL('image/png'));
    }
  };

  const redo = () => {
    if (historyStepRef.current < historyRef.current.length - 1) {
      historyStepRef.current += 1;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.putImageData(historyRef.current[historyStepRef.current], 0, 0);
      soundFx.playClick();
      if (onCanvasChange) onCanvasChange(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
    soundFx.playClick();
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  // Flood Fill Algorithm
  const floodFill = (startX: number, startY: number, fillColorHex: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Convert hex color to RGBA
    const tempDiv = document.createElement('div');
    tempDiv.style.color = fillColorHex;
    document.body.appendChild(tempDiv);
    const rgbStr = window.getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);
    
    const match = rgbStr.match(/\d+/g);
    if (!match) return;
    const targetR = parseInt(match[0], 10);
    const targetG = parseInt(match[1], 10);
    const targetB = parseInt(match[2], 10);
    const targetA = 255;

    const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    // Don't fill if same color
    if (startR === targetR && startG === targetG && startB === targetB && startA === targetA) {
      return;
    }

    const colorMatch = (pos: number) => {
      return (
        Math.abs(data[pos] - startR) < 30 &&
        Math.abs(data[pos + 1] - startG) < 30 &&
        Math.abs(data[pos + 2] - startB) < 30 &&
        Math.abs(data[pos + 3] - startA) < 30
      );
    };

    const pixelStack: [number, number][] = [[Math.floor(startX), Math.floor(startY)]];

    while (pixelStack.length > 0) {
      const popVal = pixelStack.pop();
      if (!popVal) break;
      let [x, y] = popVal;
      let pixelPos = (y * width + x) * 4;

      while (y >= 0 && colorMatch(pixelPos)) {
        y--;
        pixelPos -= width * 4;
      }
      pixelPos += width * 4;
      y++;

      let reachLeft = false;
      let reachRight = false;

      while (y < height && colorMatch(pixelPos)) {
        data[pixelPos] = targetR;
        data[pixelPos + 1] = targetG;
        data[pixelPos + 2] = targetB;
        data[pixelPos + 3] = targetA;

        if (x > 0) {
          if (colorMatch(pixelPos - 4)) {
            if (!reachLeft) {
              pixelStack.push([x - 1, y]);
              reachLeft = true;
            }
          } else if (reachLeft) {
            reachLeft = false;
          }
        }

        if (x < width - 1) {
          if (colorMatch(pixelPos + 4)) {
            if (!reachRight) {
              pixelStack.push([x + 1, y]);
              reachRight = true;
            }
          } else if (reachRight) {
            reachRight = false;
          }
        }

        y++;
        pixelPos += width * 4;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    saveHistory();
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const coords = getCoordinates(e);
    isDrawingRef.current = true;
    startPosRef.current = coords;

    if (tool === 'fill') {
      floodFill(coords.x, coords.y, color);
      isDrawingRef.current = false;
      return;
    }

    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const coords = getCoordinates(e);

    if (tool === 'pencil' || tool === 'eraser') {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      if (Math.random() < 0.2) {
        soundFx.playPencilScratch();
      }
    } else if (snapshotRef.current) {
      // For shapes (Line, Rect, Circle), restore snapshot to draw preview
      ctx.putImageData(snapshotRef.current, 0, 0);
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';

      if (tool === 'line') {
        ctx.moveTo(startPosRef.current.x, startPosRef.current.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
      } else if (tool === 'rectangle') {
        const w = coords.x - startPosRef.current.x;
        const h = coords.y - startPosRef.current.y;
        ctx.strokeRect(startPosRef.current.x, startPosRef.current.y, w, h);
      } else if (tool === 'circle') {
        const radius = Math.sqrt(
          Math.pow(coords.x - startPosRef.current.x, 2) + Math.pow(coords.y - startPosRef.current.y, 2)
        );
        ctx.arc(startPosRef.current.x, startPosRef.current.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current || disabled) return;
    isDrawingRef.current = false;
    saveHistory();
  };

  return (
    <div className="canvas-wrapper flex flex-col items-center gap-3 w-full max-w-[640px] mx-auto select-none">
      {/* Canvas Area with Notebook Style */}
      <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-700 bg-white group">
        {showGrid && (
          <div 
            className="absolute inset-0 pointer-events-none opacity-15"
            style={{
              backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          />
        )}
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full aspect-[4/3] touch-none block ${disabled ? 'cursor-not-allowed opacity-90' : 'cursor-crosshair'}`}
        />
      </div>

      {/* Toolbar Controls */}
      {!disabled && (
        <div className="toolbar bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-700 shadow-xl w-full flex flex-col gap-3">
          {/* Main Tool Pickers */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => { setTool('pencil'); soundFx.playClick(); }}
                className={`p-2 rounded-lg transition-all ${tool === 'pencil' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                title="연필 브러시"
              >
                <Pencil size={20} />
              </button>
              <button
                type="button"
                onClick={() => { setTool('eraser'); soundFx.playClick(); }}
                className={`p-2 rounded-lg transition-all ${tool === 'eraser' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                title="지우개"
              >
                <Eraser size={20} />
              </button>
              <button
                type="button"
                onClick={() => { setTool('fill'); soundFx.playClick(); }}
                className={`p-2 rounded-lg transition-all ${tool === 'fill' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                title="페인트통 (채우기)"
              >
                <PaintBucket size={20} />
              </button>
              <div className="w-[1px] h-6 bg-slate-700 mx-1" />
              <button
                type="button"
                onClick={() => { setTool('line'); soundFx.playClick(); }}
                className={`p-2 rounded-lg transition-all ${tool === 'line' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                title="직선"
              >
                <Minus size={20} />
              </button>
              <button
                type="button"
                onClick={() => { setTool('rectangle'); soundFx.playClick(); }}
                className={`p-2 rounded-lg transition-all ${tool === 'rectangle' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                title="사각형"
              >
                <Square size={20} />
              </button>
              <button
                type="button"
                onClick={() => { setTool('circle'); soundFx.playClick(); }}
                className={`p-2 rounded-lg transition-all ${tool === 'circle' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                title="원"
              >
                <CircleIcon size={20} />
              </button>
            </div>

            {/* Stroke Width Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800 p-1.5 rounded-xl">
              {STROKE_SIZES.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => { setLineWidth(sz); soundFx.playClick(); }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${lineWidth === sz ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title={`두께 ${sz}px`}
                >
                  <span 
                    className="rounded-full bg-current" 
                    style={{ width: `${Math.min(sz + 2, 16)}px`, height: `${Math.min(sz + 2, 16)}px` }}
                  />
                </button>
              ))}
            </div>

            {/* Actions: Undo / Redo / Grid / Clear */}
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={undo}
                disabled={historyStepRef.current <= 0}
                className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-all"
                title="실행 취소 (Undo)"
              >
                <RotateCcw size={18} />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={historyStepRef.current >= historyRef.current.length - 1}
                className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-all"
                title="다시 실행 (Redo)"
              >
                <RotateCw size={18} />
              </button>
              <button
                type="button"
                onClick={() => { setShowGrid(!showGrid); soundFx.playClick(); }}
                className={`p-2 rounded-lg transition-all ${showGrid ? 'text-amber-400' : 'text-slate-500'}`}
                title="눈금 모눈종이 토글"
              >
                <Grid size={18} />
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-all"
                title="전체 지우기"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          {/* Color Palette Grid */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { 
                  setColor(c); 
                  if (tool === 'eraser') setTool('pencil');
                  soundFx.playClick(); 
                }}
                className={`w-7 h-7 rounded-full shrink-0 transition-transform ${color === c && tool !== 'eraser' ? 'ring-2 ring-white scale-110 shadow-lg' : 'hover:scale-105 opacity-90'}`}
                style={{ backgroundColor: c, border: c === '#ffffff' ? '1px solid #475569' : 'none' }}
              />
            ))}
            {/* Custom Hex Color Picker */}
            <div className="relative shrink-0 w-7 h-7 rounded-full overflow-hidden border border-slate-600 flex items-center justify-center cursor-pointer">
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  if (tool === 'eraser') setTool('pencil');
                }}
                className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0"
              />
              <span className="text-[10px] font-bold text-white pointer-events-none">🎨</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
