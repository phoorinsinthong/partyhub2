import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingPath {
  color: string;
  size: number;
  points: Point[];
}

interface RealTimeCanvasProps {
  isDrawingEnabled: boolean;
  color?: string;
  brushSize?: number;
  paths: DrawingPath[];
  onPathComplete?: (path: DrawingPath) => void;
  className?: string;
  backgroundColor?: string;
  onClear?: () => void;
  readOnly?: boolean;
}

export const RealTimeCanvas: React.FC<RealTimeCanvasProps> = ({
  isDrawingEnabled,
  color = '#ffffff',
  brushSize = 3,
  paths,
  onPathComplete,
  className = '',
  backgroundColor = 'transparent',
  readOnly = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [localPaths, setLocalPaths] = useState<DrawingPath[]>([]);
  const lastPointRef = useRef<Point | null>(null);

  // Sync with remote paths
  useEffect(() => {
    setLocalPaths(paths);
  }, [paths]);

  const drawPaths = (ctx: CanvasRenderingContext2D, pathsToDraw: DrawingPath[]) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    pathsToDraw.forEach(path => {
      if (path.points.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.size;
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fill background if specified
    if (backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    drawPaths(ctx, localPaths);
  }, [localPaths, backgroundColor]);

  // Handle Resize
  useEffect(() => {
    const resize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      // Redraw immediately after resize
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (backgroundColor !== 'transparent') {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        drawPaths(ctx, localPaths);
      }
    };
    
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [localPaths, backgroundColor]);

  const getPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    // Calculate scaling ratio
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly || !isDrawingEnabled) return;
    
    // Prevent default touch behavior (scrolling) only when drawing
    if ('touches' in e && e.cancelable) {
       // Cannot call e.preventDefault() on passive event listener if attached via React in some cases,
       // but for onTouchStart standard React synthetic event it works.
       // However, we added touch-action: none to CSS to prevent scrolling.
    }

    const pos = getPos(e);
    if (!pos) return;
    
    setIsDrawing(true);
    lastPointRef.current = pos;
    
    const newPath: DrawingPath = { color, size: brushSize, points: [pos] };
    setLocalPaths(prev => [...prev, newPath]);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly || !isDrawingEnabled) return;
    
    const pos = getPos(e);
    if (!pos) return;

    // Optimization: Only add point if it moved far enough
    const lastPoint = lastPointRef.current;
    if (lastPoint) {
      const dx = pos.x - lastPoint.x;
      const dy = pos.y - lastPoint.y;
      if (dx * dx + dy * dy < 4) return; // 2px squared tolerance
    }

    lastPointRef.current = pos;
    
    setLocalPaths(prev => {
      const newPaths = [...prev];
      const lastPath = newPaths[newPaths.length - 1];
      if (lastPath) {
        lastPath.points.push(pos);
      }
      return newPaths;
    });
  };

  const handleEnd = () => {
    if (!isDrawing || readOnly || !isDrawingEnabled) return;
    setIsDrawing(false);
    lastPointRef.current = null;
    
    if (onPathComplete && localPaths.length > 0) {
      onPathComplete(localPaths[localPaths.length - 1]);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full overflow-hidden rounded-xl ${className}`}
      style={{ touchAction: readOnly || !isDrawingEnabled ? 'auto' : 'none' }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
        className={`w-full h-full ${readOnly || !isDrawingEnabled ? 'cursor-default' : 'cursor-crosshair'}`}
      />
      {!readOnly && !isDrawingEnabled && (
        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center pointer-events-none">
          <p className="font-black text-white uppercase tracking-widest text-sm drop-shadow-md">รอดูคนอื่นวาดภาพ</p>
        </div>
      )}
    </div>
  );
};
