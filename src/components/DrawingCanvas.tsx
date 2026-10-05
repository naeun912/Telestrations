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
  '#1d1b3a', '#555555', '#ffffff', '#ff5a5f',
  '#ff9f1c', '#ffd23f', '#5bd38a', '#2ec4b6',
  '#3a86ff', '#8b5cf6', '#ff7eb6', '#7f5539'
];

const STROKE_SIZES = [4, 8, 16, 28];

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  onCanvasChange,
  disabled = false,
  initialDataUrl,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState<string>('#1d1b3a');
  const [lineWidth, setLineWidth] = useState<number>(8);
  const [showGrid, setShowGrid] = useState<boolean>(false);

  const historyRef = useRef<ImageData[]>([]);
  const historyStepRef = useRef<number>(-1);

  const isDrawingRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const snapshotRef = useRef<ImageData | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 600;
    canvas.height = 450;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

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
      soundFx.click();
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
      soundFx.click();
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
    soundFx.click();
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

  const floodFill = (startX: number, startY: number, fillColorHex: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

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
      soundFx.scratch();
    } else if (snapshotRef.current) {
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
      {/* Canvas Frame */}
      <div className="canvas-wrap">
        {showGrid && (
          <div 
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: 'radial-gradient(#1d1b3a 1.5px, transparent 1.5px)',
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
          className={tool === 'fill' ? 'is-fill' : ''}
        />
      </div>

      {/* Toolbar Controls */}
      {!disabled && (
        <div className="toolbar">
          <div className="toolbar__row">
            {/* Tools */}
            <button
              type="button"
              className={`tool ${tool === 'pencil' ? 'is-on' : ''}`}
              onClick={() => { setTool('pencil'); soundFx.click(); }}
              title="마커 펜"
            >
              <Pencil size={20} />
            </button>
            <button
              type="button"
              className={`tool ${tool === 'eraser' ? 'is-on' : ''}`}
              onClick={() => { setTool('eraser'); soundFx.click(); }}
              title="지우개"
            >
              <Eraser size={20} />
            </button>
            <button
              type="button"
              className={`tool ${tool === 'fill' ? 'is-on' : ''}`}
              onClick={() => { setTool('fill'); soundFx.click(); }}
              title="페인트통 (채우기)"
            >
              <PaintBucket size={20} />
            </button>
            <button
              type="button"
              className={`tool ${tool === 'line' ? 'is-on' : ''}`}
              onClick={() => { setTool('line'); soundFx.click(); }}
              title="직선"
            >
              <Minus size={20} />
            </button>
            <button
              type="button"
              className={`tool ${tool === 'rectangle' ? 'is-on' : ''}`}
              onClick={() => { setTool('rectangle'); soundFx.click(); }}
              title="사각형"
            >
              <Square size={20} />
            </button>
            <button
              type="button"
              className={`tool ${tool === 'circle' ? 'is-on' : ''}`}
              onClick={() => { setTool('circle'); soundFx.click(); }}
              title="원"
            >
              <CircleIcon size={20} />
            </button>

            <div style={{ width: 1, height: 28, background: 'var(--ink)', opacity: 0.3 }} />

            {/* Sizes */}
            {STROKE_SIZES.map((sz) => (
              <button
                key={sz}
                type="button"
                className={`tool ${lineWidth === sz ? 'is-on' : ''}`}
                onClick={() => { setLineWidth(sz); soundFx.click(); }}
                title={`두께 ${sz}px`}
                style={{ padding: '0 8px', minWidth: 38 }}
              >
                <span 
                  className="size-dot" 
                  style={{ width: Math.min(sz + 2, 18), height: Math.min(sz + 2, 18) }} 
                />
              </button>
            ))}

            <div style={{ width: 1, height: 28, background: 'var(--ink)', opacity: 0.3 }} />

            {/* Actions */}
            <button
              type="button"
              className="tool"
              onClick={undo}
              disabled={historyStepRef.current <= 0}
              title="실행 취소"
            >
              <RotateCcw size={18} />
            </button>
            <button
              type="button"
              className="tool"
              onClick={redo}
              disabled={historyStepRef.current >= historyRef.current.length - 1}
              title="다시 실행"
            >
              <RotateCw size={18} />
            </button>
            <button
              type="button"
              className={`tool ${showGrid ? 'is-on' : ''}`}
              onClick={() => { setShowGrid(!showGrid); soundFx.click(); }}
              title="모눈종이 가이드 토글"
            >
              <Grid size={18} />
            </button>
            <button
              type="button"
              className="tool"
              onClick={clearCanvas}
              title="전체 지우기"
              style={{ color: 'var(--red)' }}
            >
              <Trash2 size={18} />
            </button>
          </div>

          {/* Marker Colors */}
          <div className="markers">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`marker ${color === c && tool !== 'eraser' ? 'is-on' : ''}`}
                onClick={() => {
                  setColor(c);
                  if (tool === 'eraser') setTool('pencil');
                  soundFx.click();
                }}
                style={{ '--c': c } as React.CSSProperties}
              />
            ))}
            <button className="marker marker--custom" title="팔레트 색상 직접 선택">
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  if (tool === 'eraser') setTool('pencil');
                }}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
