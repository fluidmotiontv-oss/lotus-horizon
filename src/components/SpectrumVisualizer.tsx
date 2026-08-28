import React, { useEffect, useRef } from 'react';

interface SpectrumVisualizerProps {
  engineRef: React.RefObject<{ radio: any } | null>;
}

export default function SpectrumVisualizer({ engineRef }: SpectrumVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    const height = 128; // Fixed height for the spectrum canvas

    const resize = () => {
      width = window.innerWidth;
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);
      
      ctx.clearRect(0, 0, width, height);

      const engine = engineRef.current;
      if (!engine || !engine.radio) return;

      const dataArray = engine.radio.getFrequencyData();
      if (!dataArray) return;

      const bufferLength = dataArray.length;
      
      // Calculate bar width based on screen size, reserving some high-end frequencies that often stay at 0
      const activeBufferLength = Math.floor(bufferLength * 0.85); 
      const barWidth = (width / activeBufferLength);
      let x = 0;

      for (let i = 0; i < activeBufferLength; i++) {
        const normalizedHeight = dataArray[i] / 255;
        // Ease the height slightly for a more pleasing visual curve
        const barHeight = Math.pow(normalizedHeight, 1.2) * height;

        // Gradient from Cyan (34, 211, 238) to Fuchsia (232, 121, 249)
        const percent = i / activeBufferLength;
        const r = 34 + (232 - 34) * percent;
        const g = 211 + (121 - 211) * percent;
        const b = 238 + (249 - 238) * percent;
        
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
        
        // Add a 1px gap between bars
        ctx.fillRect(x, height - barHeight, barWidth > 1 ? barWidth - 1 : barWidth, barHeight);

        x += barWidth;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [engineRef]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute bottom-0 left-0 w-full h-32 pointer-events-none z-10 opacity-70 mix-blend-screen"
    />
  );
}
