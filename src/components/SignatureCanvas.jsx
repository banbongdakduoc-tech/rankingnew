// src/components/SignatureCanvas.jsx
import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { RotateCcw, PenTool } from 'lucide-react';

const SignatureCanvas = forwardRef(
  (
    {
      label = 'Chữ ký',
      width = 280,
      height = 140,
      strokeColor = '#00FF87',
      backgroundColor = '#070C12',
      initialDataUrl = '',
      onChange,
      readOnly = false
    },
    ref
  ) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      getDataUrl: () => {
        if (!hasDrawn && !initialDataUrl) return '';
        const canvas = canvasRef.current;
        return canvas ? canvas.toDataURL('image/png') : initialDataUrl;
      },
      clear: () => {
        clearCanvas();
      },
      hasContent: () => hasDrawn || !!initialDataUrl
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = strokeColor;

      // If initial data URL exists, load and draw it
      if (initialDataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setHasDrawn(true);
        };
        img.src = initialDataUrl;
      }
    }, [initialDataUrl, strokeColor]);

    const getCanvasCoordinates = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();

      let clientX, clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const startDrawing = (e) => {
      if (readOnly) return;
      if (e.cancelable && e.type.startsWith('touch')) {
        e.preventDefault();
      }

      const { x, y } = getCanvasCoordinates(e);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    };

    const draw = (e) => {
      if (!isDrawing || readOnly) return;
      if (e.cancelable && e.type.startsWith('touch')) {
        e.preventDefault();
      }

      const { x, y } = getCanvasCoordinates(e);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      ctx.lineTo(x, y);
      ctx.stroke();
      if (!hasDrawn) {
        setHasDrawn(true);
      }
    };

    const stopDrawing = () => {
      if (!isDrawing || readOnly) return;
      setIsDrawing(false);
      if (onChange) {
        const canvas = canvasRef.current;
        onChange(canvas.toDataURL('image/png'));
      }
    };

    const clearCanvas = () => {
      if (readOnly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      setHasDrawn(false);
      if (onChange) {
        onChange('');
      }
    };

    return (
      <div className="signature-box">
        <div className="signature-header">
          <span className="signature-label">
            <PenTool size={14} className="text-accent" />
            {label}
          </span>
          {!readOnly && (
            <button
              type="button"
              className="btn ghost tiny"
              onClick={clearCanvas}
              title="Xóa chữ ký để ký lại"
            >
              <RotateCcw size={12} />
              Xóa nét
            </button>
          )}
        </div>

        <div className="signature-canvas-wrapper" style={{ width: '100%', maxWidth: `${width}px` }}>
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={`signature-canvas ${readOnly ? 'readonly' : ''}`}
            style={{
              backgroundColor: backgroundColor,
              touchAction: 'none'
            }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {!hasDrawn && !initialDataUrl && !readOnly && (
            <div className="signature-placeholder">Ký tên tại đây (Chạm hoặc dùng chuột)</div>
          )}
        </div>
      </div>
    );
  }
);

SignatureCanvas.displayName = 'SignatureCanvas';
export default SignatureCanvas;
