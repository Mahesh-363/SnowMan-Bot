import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AssistantState, AssistantEmotion } from '../types/assistant';
import { audioPlayer } from '../services/audioPlayer';

interface NeuroBrainCanvasProps {
  state: AssistantState;
  emotion: AssistantEmotion;
  className?: string;
}

/**
 * Creates soft glowing circular particle sprite texture for synaptic nodes
 */
function createNodeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.2, 'rgba(255, 235, 160, 0.95)');
  gradient.addColorStop(0.5, 'rgba(217, 70, 239, 0.45)');
  gradient.addColorStop(0.8, 'rgba(139, 92, 246, 0.15)');
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export const NeuroBrainCanvas: React.FC<NeuroBrainCanvasProps> = ({
  state,
  emotion,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<AssistantState>(state);
  const emotionRef = useRef<AssistantEmotion>(emotion);
  const audioEnergyRef = useRef<number>(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    emotionRef.current = emotion;
  }, [emotion]);

  useEffect(() => {
    const unsub = audioPlayer.onMouthOpen((val) => {
      audioEnergyRef.current = val;
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      38,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Well-balanced 3/4 profile perspective framing the neural synapse network
    camera.position.set(1.4, 0.45, 5.6);
    camera.lookAt(0, 0.22, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // Root Brain Group - positioned in upper canvas with generous margin
    const brainGroup = new THREE.Group();
    brainGroup.position.set(0, 0.22, 0);
    brainGroup.rotation.y = -0.32;
    brainGroup.rotation.x = 0.08;
    scene.add(brainGroup);

    // Dynamic Shader Uniforms driving electric crackle, pulses & emotion accents
    const networkUniforms = {
      uTime: { value: 0 },
      uAudioPulse: { value: 0 },
      uListening: { value: 0 },
      uBasePurple: { value: new THREE.Color('#9333EA') }, // Deep Electric Purple
      uBaseMagenta: { value: new THREE.Color('#FF4AE0') }, // Vibrant Neon Magenta
      uAccentColor: { value: new THREE.Color('#FFE87A') }, // Lightning Crackle Yellow-White
    };

    // --- 1. Line Shader: Glowing Synaptic Connection Network ---
    const lineMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: networkUniforms.uTime,
        uAudioPulse: networkUniforms.uAudioPulse,
        uListening: networkUniforms.uListening,
        uBasePurple: networkUniforms.uBasePurple,
        uBaseMagenta: networkUniforms.uBaseMagenta,
        uAccentColor: networkUniforms.uAccentColor,
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aLineId;
        attribute float aIsAccent;
        attribute float aT;

        varying vec3 vColor;
        varying float vLineId;
        varying float vIsAccent;
        varying float vT;

        void main() {
          vColor = aColor;
          vLineId = aLineId;
          vIsAccent = aIsAccent;
          vT = aT;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uAudioPulse;
        uniform float uListening;
        uniform vec3 uBasePurple;
        uniform vec3 uBaseMagenta;
        uniform vec3 uAccentColor;

        varying vec3 vColor;
        varying float vLineId;
        varying float vIsAccent;
        varying float vT;

        void main() {
          // Asynchronous per-line shimmer and natural breathing
          float fSpeed = 3.6 + uListening * 3.2;
          float f1 = sin(uTime * fSpeed + vLineId * 17.13);
          float f2 = cos(uTime * (fSpeed * 1.7) + vLineId * 31.47);
          float baseFlicker = 0.55 + 0.30 * f1 + 0.15 * f2;

          // Electrical action potentials traveling along the synapse line
          float pulseSpeed = 5.5 + uAudioPulse * 9.0;
          float pulsePhase = uTime * pulseSpeed + vLineId * 6.28318;
          float travelPulse = pow(sin(vT * 3.14159 + pulsePhase) * 0.5 + 0.5, 6.0);

          // Lightning crackle spikes along accent lines
          float crackleNoise = sin(uTime * 15.0 + vLineId * 43.12);
          float crackleTrigger = step(0.60, crackleNoise) * vIsAccent;
          float crackleFlare = crackleTrigger * (0.8 + uAudioPulse * 2.2);

          // Audio speech excitation
          float speechSurge = uAudioPulse * (1.2 + 1.6 * vIsAccent);

          // Color gradient across purple/magenta base network
          vec3 col = mix(uBasePurple, uBaseMagenta, sin(vLineId + uTime * 0.6) * 0.5 + 0.5);
          if (vIsAccent > 0.5) {
            col = mix(col, uAccentColor, 0.85);
          }

          // Electric surge highlights
          col = mix(col, uAccentColor, travelPulse * 0.65 + crackleFlare);

          float brightness = (baseFlicker + travelPulse * 0.75 + crackleFlare + speechSurge) * (1.0 + uAudioPulse * 0.75);

          // Smooth edge falloff along line segments
          float edgeFade = sin(vT * 3.14159);
          float alpha = clamp(brightness * (0.35 + 0.65 * edgeFade), 0.0, 1.0);

          gl_FragColor = vec4(col * brightness * 1.5, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // --- 2. Point Shader: Glowing Synaptic Nodes ---
    const nodeSprite = createNodeTexture();
    const nodeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: networkUniforms.uTime,
        uAudioPulse: networkUniforms.uAudioPulse,
        uListening: networkUniforms.uListening,
        uBasePurple: networkUniforms.uBasePurple,
        uBaseMagenta: networkUniforms.uBaseMagenta,
        uAccentColor: networkUniforms.uAccentColor,
        uSprite: { value: nodeSprite },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aNodeId;
        attribute float aIsAccent;

        uniform float uTime;
        uniform float uAudioPulse;
        uniform float uListening;

        varying float vNodeId;
        varying float vIsAccent;

        void main() {
          vNodeId = aNodeId;
          vIsAccent = aIsAccent;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

          // Asynchronous node pulsation & audio scaling
          float fSpeed = 4.0 + uListening * 2.8;
          float flicker = 0.82 + 0.22 * sin(uTime * fSpeed + aNodeId * 13.7) + 0.12 * cos(uTime * (fSpeed * 2.1) + aNodeId * 29.1);
          float audioBoost = uAudioPulse * (1.4 + aIsAccent * 1.6);

          float size = aSize * (flicker + audioBoost);
          gl_PointSize = size * (280.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uAudioPulse;
        uniform vec3 uBasePurple;
        uniform vec3 uBaseMagenta;
        uniform vec3 uAccentColor;
        uniform sampler2D uSprite;

        varying float vNodeId;
        varying float vIsAccent;

        void main() {
          vec4 sprite = texture2D(uSprite, gl_PointCoord);
          if (sprite.a < 0.015) discard;

          vec3 col = mix(uBasePurple, uBaseMagenta, sin(vNodeId * 3.14) * 0.5 + 0.5);
          if (vIsAccent > 0.5) {
            col = mix(col, uAccentColor, 0.88);
          }

          // Random spontaneous synaptic firing flashes
          float flash = step(0.93, sin(uTime * 12.0 + vNodeId * 53.2)) * (0.8 + uAudioPulse * 1.6);
          col = mix(col, vec3(1.0, 1.0, 0.92), flash * 0.85);

          float intensity = (1.3 + flash * 1.6 + uAudioPulse * 1.8);
          gl_FragColor = vec4(col * intensity, sprite.a * (0.85 + flash * 0.15));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // --- 3. Optional Dark Silhouette Mesh (Hidden by default to match reference) ---
    // Pure network effect defines the silhouette.
    const silhouetteMaterial = new THREE.MeshBasicMaterial({
      color: 0x05010a,
      transparent: true,
      opacity: 0.45,
      depthWrite: true,
    });

    let networkLineMesh: THREE.LineSegments | null = null;
    let networkPointsMesh: THREE.Points | null = null;
    let brainSilhouetteMesh: THREE.Mesh | null = null;

    let lineGeom: THREE.BufferGeometry | null = null;
    let pointsGeom: THREE.BufferGeometry | null = null;

    // Load brain.glb and sample surface to construct neural synapse network
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      '/brain.glb',
      (gltf) => {
        let brainGeom: THREE.BufferGeometry | null = null;
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && !brainGeom) {
            brainGeom = (child as THREE.Mesh).geometry;
          }
        });

        if (!brainGeom) {
          console.error('No mesh found in /brain.glb');
          return;
        }

        // Center and scale normalization
        const posAttr = (brainGeom as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute;
        const box = new THREE.Box3().setFromBufferAttribute(posAttr);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 2.6 / maxDim; // Scaled down to leave comfortable breathing room on all sides

        // Create dark silhouette mesh (hidden by default)
        const centeredGeom = (brainGeom as THREE.BufferGeometry).clone();
        centeredGeom.translate(-center.x, -center.y, -center.z);
        centeredGeom.scale(scaleFactor, scaleFactor, scaleFactor);
        centeredGeom.computeVertexNormals();

        brainSilhouetteMesh = new THREE.Mesh(centeredGeom, silhouetteMaterial);
        brainSilhouetteMesh.visible = false; // Pure network effect defines silhouette
        brainGroup.add(brainSilhouetteMesh);

        // --- Step A: Poisson-like Spatial Surface Sampling (~1000 nodes) ---
        const totalVerts = posAttr.count;
        const sampledPoints: THREE.Vector3[] = [];
        const minDist = 0.082; // Scaled proportionally for 2.6 units (maintains ~1000 dense nodes)
        const minDistSq = minDist * minDist;

        for (let i = 0; i < totalVerts; i += 3) {
          const x = (posAttr.getX(i) - center.x) * scaleFactor;
          const y = (posAttr.getY(i) - center.y) * scaleFactor;
          const z = (posAttr.getZ(i) - center.z) * scaleFactor;

          let tooClose = false;
          for (let j = 0; j < sampledPoints.length; j++) {
            const p = sampledPoints[j];
            const dx = x - p.x;
            const dy = y - p.y;
            const dz = z - p.z;
            if (dx * dx + dy * dy + dz * dz < minDistSq) {
              tooClose = true;
              break;
            }
          }

          if (!tooClose) {
            sampledPoints.push(new THREE.Vector3(x, y, z));
            if (sampledPoints.length >= 1000) break;
          }
        }

        const nodeCount = sampledPoints.length;

        // --- Step B: Connect 3-5 Nearest Neighbors within Surface Cutoff ---
        const maxEdgeDist = 0.26; // Scaled cutoff matching 2.6 units model size
        const edges = new Set<string>();
        const lineSegments: { p1: THREE.Vector3; p2: THREE.Vector3; id: number; isAccent: number }[] = [];

        for (let i = 0; i < nodeCount; i++) {
          const p1 = sampledPoints[i];
          const dists: { j: number; d: number }[] = [];

          for (let j = 0; j < nodeCount; j++) {
            if (i === j) continue;
            const p2 = sampledPoints[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dz = p1.z - p2.z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d <= maxEdgeDist) {
              dists.push({ j, d });
            }
          }

          dists.sort((a, b) => a.d - b.d);
          const connectCount = Math.min(dists.length, 4);

          for (let k = 0; k < connectCount; k++) {
            const j = dists[k].j;
            const edgeKey = i < j ? `${i}_${j}` : `${j}_${i}`;
            if (!edges.has(edgeKey)) {
              edges.add(edgeKey);
              const isAccent = Math.random() < 0.14 ? 1.0 : 0.0;
              lineSegments.push({
                p1,
                p2: sampledPoints[j],
                id: edges.size,
                isAccent,
              });
            }
          }
        }

        // --- Step C: Build Unified LineSegments Geometry ---
        const segmentCount = lineSegments.length;
        const linePosArray = new Float32Array(segmentCount * 6);
        const lineColorArray = new Float32Array(segmentCount * 6);
        const lineIdArray = new Float32Array(segmentCount * 2);
        const lineIsAccentArray = new Float32Array(segmentCount * 2);
        const lineTArray = new Float32Array(segmentCount * 2);

        const purpleCol = new THREE.Color('#9333EA');
        const magentaCol = new THREE.Color('#FF4AE0');
        const yellowCol = new THREE.Color('#FFE87A');

        for (let i = 0; i < segmentCount; i++) {
          const seg = lineSegments[i];
          const vIdx = i * 6;
          const vertIdx = i * 2;

          // Vertex 1
          linePosArray[vIdx] = seg.p1.x;
          linePosArray[vIdx + 1] = seg.p1.y;
          linePosArray[vIdx + 2] = seg.p1.z;

          // Vertex 2
          linePosArray[vIdx + 3] = seg.p2.x;
          linePosArray[vIdx + 4] = seg.p2.y;
          linePosArray[vIdx + 5] = seg.p2.z;

          const baseCol = seg.isAccent > 0.5 ? yellowCol : Math.random() > 0.5 ? purpleCol : magentaCol;

          lineColorArray[vIdx] = baseCol.r;
          lineColorArray[vIdx + 1] = baseCol.g;
          lineColorArray[vIdx + 2] = baseCol.b;

          lineColorArray[vIdx + 3] = baseCol.r;
          lineColorArray[vIdx + 4] = baseCol.g;
          lineColorArray[vIdx + 5] = baseCol.b;

          lineIdArray[vertIdx] = seg.id;
          lineIdArray[vertIdx + 1] = seg.id;

          lineIsAccentArray[vertIdx] = seg.isAccent;
          lineIsAccentArray[vertIdx + 1] = seg.isAccent;

          lineTArray[vertIdx] = 0.0;
          lineTArray[vertIdx + 1] = 1.0;
        }

        lineGeom = new THREE.BufferGeometry();
        lineGeom.setAttribute('position', new THREE.BufferAttribute(linePosArray, 3));
        lineGeom.setAttribute('aColor', new THREE.BufferAttribute(lineColorArray, 3));
        lineGeom.setAttribute('aLineId', new THREE.BufferAttribute(lineIdArray, 1));
        lineGeom.setAttribute('aIsAccent', new THREE.BufferAttribute(lineIsAccentArray, 1));
        lineGeom.setAttribute('aT', new THREE.BufferAttribute(lineTArray, 1));

        networkLineMesh = new THREE.LineSegments(lineGeom, lineMaterial);
        brainGroup.add(networkLineMesh);

        // --- Step D: Build Unified Points Geometry (Synapse Nodes) ---
        const pointsPosArray = new Float32Array(nodeCount * 3);
        const pointsSizeArray = new Float32Array(nodeCount);
        const pointsIdArray = new Float32Array(nodeCount);
        const pointsIsAccentArray = new Float32Array(nodeCount);

        for (let i = 0; i < nodeCount; i++) {
          const pt = sampledPoints[i];
          pointsPosArray[i * 3] = pt.x;
          pointsPosArray[i * 3 + 1] = pt.y;
          pointsPosArray[i * 3 + 2] = pt.z;

          const isAccent = Math.random() < 0.16 ? 1.0 : 0.0;
          pointsIsAccentArray[i] = isAccent;

          // Varied random node sizing matching reference (scaled for 2.6 model)
          const baseSize = isAccent ? 0.13 + Math.random() * 0.07 : 0.065 + Math.random() * 0.065;
          pointsSizeArray[i] = baseSize;
          pointsIdArray[i] = i;
        }

        pointsGeom = new THREE.BufferGeometry();
        pointsGeom.setAttribute('position', new THREE.BufferAttribute(pointsPosArray, 3));
        pointsGeom.setAttribute('aSize', new THREE.BufferAttribute(pointsSizeArray, 1));
        pointsGeom.setAttribute('aNodeId', new THREE.BufferAttribute(pointsIdArray, 1));
        pointsGeom.setAttribute('aIsAccent', new THREE.BufferAttribute(pointsIsAccentArray, 1));

        networkPointsMesh = new THREE.Points(pointsGeom, nodeMaterial);
        brainGroup.add(networkPointsMesh);
      },
      undefined,
      (err) => {
        console.error('Error loading /brain.glb:', err);
      }
    );

    // Mouse Parallax tracking
    let targetRotX = 0.08;
    let targetRotY = -0.32;
    let currentRotX = 0.08;
    let currentRotY = -0.32;

    const handleMouseMove = (e: MouseEvent) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      targetRotY = -0.32 + normX * 0.25;
      targetRotX = 0.08 - normY * 0.18;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Window Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      const currentState = stateRef.current;
      const currentEmotion = emotionRef.current;
      const rawAudio = audioEnergyRef.current;

      const audioPulse = Math.min(1.0, rawAudio * 1.5);

      // Emotion Tinting: Shift accent lightning crackle color
      if (currentEmotion === 'happy') {
        networkUniforms.uAccentColor.value.set('#FFF275'); // Bright Radiant Gold
      } else if (currentEmotion === 'confused') {
        networkUniforms.uAccentColor.value.set('#00F0FF'); // Electric Cyan
      } else {
        networkUniforms.uAccentColor.value.set('#FFE87A'); // Electric Warm Yellow-White
      }

      networkUniforms.uTime.value = elapsedTime;
      networkUniforms.uAudioPulse.value = audioPulse;
      networkUniforms.uListening.value = currentState === 'listening' ? 1.0 : 0.0;

      // Reactive Scale Pulse & Heartbeat Animation
      let pulseScale = 1.0;

      if (currentState === 'speaking') {
        const speechBeat = Math.sin(elapsedTime * 6.0) * 0.035;
        pulseScale = 1.0 + speechBeat + audioPulse * 0.18;
      } else if (currentState === 'thinking') {
        const erraticPulse =
          Math.sin(elapsedTime * 7.5) * 0.045 +
          Math.cos(elapsedTime * 11.0) * 0.025;
        pulseScale = 1.0 + erraticPulse;
      } else if (currentState === 'listening') {
        const listenPulse = Math.sin(elapsedTime * 2.2) * 0.04;
        pulseScale = 1.03 + listenPulse;
      } else {
        // Idle: Visible organic breathing heartbeat pulse (~1.75s cycle, ~7.5% amplitude)
        const primaryBreath = Math.sin(elapsedTime * 3.6) * 0.045;
        const heartbeatKick =
          Math.pow(Math.max(0, Math.sin(elapsedTime * 3.6)), 3.0) * 0.035;
        pulseScale = 1.0 + primaryBreath + heartbeatKick;
      }

      brainGroup.scale.set(pulseScale, pulseScale, pulseScale);

      // Mouse Parallax & Gentle Idle Floating
      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;

      const idleFloatY = Math.sin(elapsedTime * 1.2) * 0.04;
      brainGroup.position.y = 0.22 + idleFloatY;
      brainGroup.rotation.x = currentRotX + Math.sin(elapsedTime * 0.7) * 0.02;
      brainGroup.rotation.y = currentRotY + Math.sin(elapsedTime * 0.4) * 0.03;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup & Resource Deallocation
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      if (networkLineMesh) {
        brainGroup.remove(networkLineMesh);
      }
      if (networkPointsMesh) {
        brainGroup.remove(networkPointsMesh);
      }
      if (brainSilhouetteMesh) {
        brainGroup.remove(brainSilhouetteMesh);
      }

      if (lineGeom) lineGeom.dispose();
      if (pointsGeom) pointsGeom.dispose();
      if (brainSilhouetteMesh) brainSilhouetteMesh.geometry.dispose();

      lineMaterial.dispose();
      nodeMaterial.dispose();
      silhouetteMaterial.dispose();
      nodeSprite.dispose();

      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden ${className}`}
    />
  );
};
