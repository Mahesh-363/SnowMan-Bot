import React, { useEffect, useRef, useState } from 'react';
import { AssistantState, AssistantEmotion } from '../types/assistant';
import { audioPlayer } from '../services/audioPlayer';

interface Live2DCanvasProps {
  state: AssistantState;
  emotion: AssistantEmotion;
  modelUrl?: string;
  width?: number | string;
  height?: number | string;
}

export const Live2DCanvas: React.FC<Live2DCanvasProps> = ({
  state,
  emotion,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mouthOpen, setMouthOpen] = useState<number>(0);
  const mouthOpenRef = useRef<number>(0);
  const stateRef = useRef<AssistantState>(state);
  const emotionRef = useRef<AssistantEmotion>(emotion);

  // Keep refs updated for high-frequency animation loop
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    emotionRef.current = emotion;
  }, [emotion]);

  // Subscribe to real-time speech lip-sync audio analyzer
  useEffect(() => {
    const unsubscribe = audioPlayer.onMouthOpen((val) => {
      mouthOpenRef.current = val;
      setMouthOpen(val);
    });
    return () => unsubscribe();
  }, []);

  // Main 60FPS Full-Screen Canvas Neural Face Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse tracking for 3D parallax head rotation & pupil gaze
    let targetLookX = 0;
    let targetLookY = 0;
    let currentLookX = 0;
    let currentLookY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetLookX = ((e.clientX / window.innerWidth) * 2 - 1) * 32;
      targetLookY = ((e.clientY / window.innerHeight) * 2 - 1) * 24;
    };

    const handleResize = () => {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Floating neural background particles
    const particles = Array.from({ length: 65 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 2 + 0.8,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.2,
    }));

    // Natural blinking timing
    let blinkValue = 0; // 0 = open, 1 = fully closed
    let isBlinking = false;
    let nextBlinkTime = Date.now() + 3000;

    let frameCount = 0;

    const render = () => {
      frameCount++;
      const now = Date.now();
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;

      // Handle natural blinking
      if (!isBlinking && now > nextBlinkTime) {
        isBlinking = true;
      }
      if (isBlinking) {
        blinkValue += 0.22;
        if (blinkValue >= 1) {
          blinkValue = 1;
          isBlinking = false;
          nextBlinkTime = now + 3500 + Math.random() * 3000;
        }
      } else if (blinkValue > 0) {
        blinkValue = Math.max(0, blinkValue - 0.22);
      }

      // Smooth camera/look lerp
      currentLookX += (targetLookX - currentLookX) * 0.08;
      currentLookY += (targetLookY - currentLookY) * 0.08;

      const currentState = stateRef.current;
      const currentEmotion = emotionRef.current;
      const currentMouth = mouthOpenRef.current;

      // Colors based on state and emotion
      let primaryColor = '#38bdf8'; // Sky cyan
      let glowColor = 'rgba(56, 189, 248, 0.4)';
      let accentColor = '#0284c7';

      if (currentState === 'speaking') {
        primaryColor = '#38bdf8';
        glowColor = 'rgba(14, 165, 233, 0.55)';
        accentColor = '#38bdf8';
      } else if (currentState === 'thinking') {
        primaryColor = '#c084fc'; // Purple
        glowColor = 'rgba(192, 132, 252, 0.55)';
        accentColor = '#a855f7';
      } else if (currentState === 'listening') {
        primaryColor = '#34d399'; // Emerald
        glowColor = 'rgba(52, 211, 153, 0.55)';
        accentColor = '#10b981';
      } else if (currentEmotion === 'happy') {
        primaryColor = '#2dd4bf'; // Teal
        glowColor = 'rgba(45, 212, 191, 0.5)';
        accentColor = '#0d9488';
      } else if (currentEmotion === 'confused') {
        primaryColor = '#fbbf24'; // Amber
        glowColor = 'rgba(251, 191, 36, 0.5)';
        accentColor = '#f59e0b';
      }

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear Canvas
      ctx.clearRect(0, 0, currentWidth, currentHeight);

      // 1. Draw Ambient Floating Particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = currentWidth;
        if (p.x > currentWidth) p.x = 0;
        if (p.y < 0) p.y = currentHeight;
        if (p.y > currentHeight) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = glowColor;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Dynamic avatar scaling: proportionally fill viewport without clipping or distortion
      const targetScale = Math.min(currentWidth / 560, (currentHeight - 160) / 580);
      const faceScale = Math.max(0.72, Math.min(targetScale, 1.75));

      // Head Center Position with breathing & look offset (elevated to leave clean room for captions below chin)
      const breath = Math.sin(frameCount * 0.04) * 4;
      const centerX = currentWidth / 2 + currentLookX;
      const centerY = currentHeight * 0.42 + currentLookY + breath;

      // 2. Audio Wave Aura & Radial Holographic Discs
      const auraRadius = (260 + (currentState === 'speaking' ? currentMouth * 60 : 0)) * faceScale;
      const radGrad = ctx.createRadialGradient(centerX, centerY, 40 * faceScale, centerX, centerY, auraRadius);
      radGrad.addColorStop(0, glowColor);
      radGrad.addColorStop(0.6, glowColor.replace('0.55', '0.15').replace('0.4', '0.1'));
      radGrad.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(centerX, centerY, auraRadius, 0, Math.PI * 2);
      ctx.fillStyle = radGrad;
      ctx.fill();

      // Soundwave pulse rings when speaking or listening
      if (currentState === 'speaking' || currentState === 'listening') {
        for (let ring = 1; ring <= 3; ring++) {
          const pulseOffset = ((frameCount * 1.5 + ring * 50) % 150);
          const ringRadius = (180 + pulseOffset + currentMouth * 30) * faceScale;
          ctx.beginPath();
          ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = Math.max(0.5, (2.5 - pulseOffset / 60) * faceScale);
          ctx.globalAlpha = Math.max(0, 0.4 - pulseOffset / 150);
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
      }

      // 3. Cyber Head Contour Mesh (Futuristic Anime / Cyborg Silhouette)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(faceScale, faceScale);

      // Outer Skull Wireframe Curve
      ctx.beginPath();
      ctx.moveTo(0, -195);
      ctx.bezierCurveTo(125, -195, 175, -100, 160, 20);
      ctx.bezierCurveTo(150, 95, 85, 165, 0, 195);
      ctx.bezierCurveTo(-85, 165, -150, 95, -160, 20);
      ctx.bezierCurveTo(-175, -100, -125, -195, 0, -195);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner Face Surface Shading
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.fill();

      // 4. Forehead Neural Circuit Interface Lines
      ctx.beginPath();
      ctx.moveTo(-75, -110);
      ctx.lineTo(-20, -135);
      ctx.lineTo(20, -135);
      ctx.lineTo(75, -110);
      ctx.moveTo(0, -135);
      ctx.lineTo(0, -170);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Forehead Central Glowing Neural Core Node
      ctx.beginPath();
      ctx.arc(0, -135, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = primaryColor;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      // 5. Stylized Holographic Eyebrows (React to emotion)
      const browY = -48;
      let leftBrowTilt = 0;
      let rightBrowTilt = 0;
      if (currentEmotion === 'happy') {
        leftBrowTilt = -5;
        rightBrowTilt = 5;
      } else if (currentEmotion === 'confused') {
        leftBrowTilt = -8;
        rightBrowTilt = -2;
      }

      // Left Eyebrow
      ctx.beginPath();
      ctx.moveTo(-82, browY + leftBrowTilt);
      ctx.lineTo(-28, browY - 4 - leftBrowTilt);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Right Eyebrow
      ctx.beginPath();
      ctx.moveTo(28, browY - 4 - rightBrowTilt);
      ctx.lineTo(82, browY + rightBrowTilt);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      // 6. High-Tech Cyber Eyes with Blinking and Pupil Tracking
      const eyeSpacing = 52;
      const eyeBaseY = -15;
      const eyeWidth = 26;
      const eyeMaxHeight = 18;
      const eyeHeight = eyeMaxHeight * (1 - blinkValue);

      [-1, 1].forEach((side) => {
        const eyeX = side * eyeSpacing;
        ctx.save();
        ctx.translate(eyeX, eyeBaseY);

        if (eyeHeight > 2) {
          // Eye Sclera / Background Outer Glow
          ctx.beginPath();
          ctx.ellipse(0, 0, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
          ctx.fill();
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Iris Hologram Disc
          const pupilOffsetX = (currentLookX / 32) * 5;
          const pupilOffsetY = (currentLookY / 24) * 3;
          ctx.beginPath();
          ctx.ellipse(pupilOffsetX, pupilOffsetY, 12, eyeHeight * 0.75, 0, 0, Math.PI * 2);
          ctx.fillStyle = primaryColor;
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Inner Glowing Pupil
          ctx.beginPath();
          ctx.arc(pupilOffsetX, pupilOffsetY, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          // Eye Highlight Glint
          ctx.beginPath();
          ctx.arc(pupilOffsetX - 4, pupilOffsetY - 4, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          // Eye Tech Eyelash / Outline Accent
          ctx.beginPath();
          ctx.moveTo(-eyeWidth - 2, -2);
          ctx.lineTo(eyeWidth + 2, -2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          // Closed Eyelid Line
          ctx.beginPath();
          ctx.moveTo(-eyeWidth, 0);
          ctx.lineTo(eyeWidth, 0);
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        ctx.restore();
      });

      // 7. Subtle Nose Geometry
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.lineTo(0, 42);
      ctx.lineTo(-8, 48);
      ctx.moveTo(0, 42);
      ctx.lineTo(8, 48);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 8. Audio-Reactive Morphing Mouth & Lip-Sync
      const mouthY = 100;
      const mouthBaseWidth = 32;
      const mouthOpenAmount = currentMouth; // 0 to 1 from real-time Web Audio Analyser

      // Real-time lip sync animation: active whenever speech audio has amplitude OR state is speaking
      let effectiveMouth = 0;
      if (mouthOpenAmount > 0.02) {
        effectiveMouth = Math.min(1.0, mouthOpenAmount * 1.35);
      } else if (currentState === 'speaking') {
        // Natural phonetic cadence during subtle vocal pauses
        effectiveMouth = 0.28 + Math.sin(frameCount * 0.35) * 0.2;
      }

      const mouthWidth = mouthBaseWidth + effectiveMouth * 36;
      const mouthHeight = Math.max(2.5, effectiveMouth * 32);

      ctx.save();
      ctx.translate(0, mouthY);

      if (effectiveMouth > 0.08) {
        // Open Mouth Inner Void with audio-reactive glow
        ctx.beginPath();
        ctx.ellipse(0, 0, mouthWidth, mouthHeight, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
        ctx.fill();
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Equalizer Bars inside mouth opening
        const barCount = 7;
        for (let b = 0; b < barCount; b++) {
          const bx = ((b - (barCount - 1) / 2) * (mouthWidth * 1.5)) / barCount;
          const bh = Math.sin((frameCount * 0.3) + b) * mouthHeight * 0.7;
          ctx.beginPath();
          ctx.moveTo(bx, -bh);
          ctx.lineTo(bx, bh);
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else {
        // Closed / Smiling Lip Line
        const smileCurve = currentEmotion === 'happy' ? -6 : 0;
        ctx.beginPath();
        ctx.moveTo(-mouthWidth, 0);
        ctx.quadraticCurveTo(0, smileCurve + 3, mouthWidth, 0);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.restore();

      // 9. Side HUD Frequency Equalizer Arcs
      const eqSideX = 180;
      for (let side of [-1, 1]) {
        ctx.save();
        ctx.scale(side, 1);
        for (let bar = 0; bar < 9; bar++) {
          const barY = -60 + bar * 18;
          const barLen = 10 + Math.abs(Math.sin(frameCount * 0.1 + bar)) * (currentState === 'speaking' ? 26 * (currentMouth + 0.5) : 8);
          ctx.beginPath();
          ctx.moveTo(eqSideX, barY);
          ctx.lineTo(eqSideX + barLen, barY);
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6;
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1.0;

      ctx.restore(); // Restore Head Transform

      // 10. Sci-Fi HUD Corner Brackets & Diagnostics
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 1.5;

      // Top Left Corner
      ctx.beginPath();
      ctx.moveTo(24, 60);
      ctx.lineTo(24, 24);
      ctx.lineTo(60, 24);
      ctx.stroke();

      // Top Right Corner
      ctx.beginPath();
      ctx.moveTo(currentWidth - 60, 24);
      ctx.lineTo(currentWidth - 24, 24);
      ctx.lineTo(currentWidth - 24, 60);
      ctx.stroke();

      // Diagnostics Text HUD
      ctx.font = '11px monospace';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.fillText(`NEURAL_CORE // STATE: ${currentState.toUpperCase()}`, 32, 44);
      ctx.fillText(`EMOTION: ${currentEmotion.toUpperCase()} | AMP: ${(currentMouth * 100).toFixed(0)}%`, 32, 60);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="relative w-screen h-screen flex items-center justify-center select-none overflow-hidden bg-slate-950">
      {/* Full-Page Neural Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block cursor-crosshair"
      />
    </div>
  );
};
