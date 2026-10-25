import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface Aiconekt3DSceneProps {
  interactive?: boolean;
  className?: string;
  onLoaded?: () => void;
}

export const Aiconekt3DScene: React.FC<Aiconekt3DSceneProps> = ({
  interactive = true,
  className = '',
  onLoaded,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [scrollPercent, setScrollPercent] = useState<number>(0);

  useEffect(() => {
    // Check prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);
    const motionHandler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener('change', motionHandler);

    return () => {
      motionQuery.removeEventListener('change', motionHandler);
    };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // WebGL capability check
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglSupported(false);
        return;
      }
    } catch {
      setWebglSupported(false);
      return;
    }

    // 1. Scene, Camera, Renderer Setup
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 650;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.045);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    // Compelling 3/4 initial perspective framing
    camera.position.set(0, 0, 7.8);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Materials Setup (PBR Metallic Hierarchy — Official Orange-to-Red Orbital A Identity)
    // Warm Luminous Orange Metallic Finish (Left Pylon)
    const darkTitaniumMaterial = new THREE.MeshStandardMaterial({
      color: 0xff7a00,
      metalness: 0.88,
      roughness: 0.22,
      envMapIntensity: 2.0,
    });

    // Deep Rich Crimson Red Metallic Finish (Right Facet Blade)
    const polishedSilverMaterial = new THREE.MeshStandardMaterial({
      color: 0xd62000,
      metalness: 0.92,
      roughness: 0.16,
      envMapIntensity: 2.2,
    });

    // Cybernetic Recessed Connector Crossbar Material
    const cyberConnectorMaterial = new THREE.MeshStandardMaterial({
      color: 0x240600,
      metalness: 0.8,
      roughness: 0.35,
    });

    // Integrated 3D Orbital Energy Torus Material (Glowing Warm Orange-Gold Swept Ring)
    const orbitalRingMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff9900,
      emissive: 0xff3b00,
      emissiveIntensity: 0.7,
      roughness: 0.08,
      metalness: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 1.0,
    });

    // Quantum Singularity Core Crystal Material (Solar Radiant Flare)
    const quantumCoreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffe6b8,
      emissive: 0xff7700,
      emissiveIntensity: 0.95,
      roughness: 0.05,
      transmission: 0.6,
      thickness: 0.8,
    });

    // 3. Geometry Construction: The Engineered Emblem
    const emblemGroup = new THREE.Group();

    // A. Left Architectural Pylon (Cantilevered Column with 45° Apex Cut & Bevels)
    const leftShape = new THREE.Shape();
    leftShape.moveTo(0, 1.8);
    leftShape.lineTo(-0.65, 1.8);
    leftShape.lineTo(-1.65, -1.8);
    leftShape.lineTo(-0.95, -1.8);
    leftShape.lineTo(-0.35, 0.2);
    leftShape.lineTo(0, 0.2);
    leftShape.closePath();

    const extrudeSettings = {
      depth: 0.32,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.07,
      bevelThickness: 0.07,
    };

    const leftGeometry = new THREE.ExtrudeGeometry(leftShape, extrudeSettings);
    leftGeometry.center();
    const leftPylon = new THREE.Mesh(leftGeometry, darkTitaniumMaterial);
    leftPylon.position.set(-0.65, 0.05, 0);
    emblemGroup.add(leftPylon);

    // B. Right Architectural Pylon (Faceted Titanium Blade)
    const rightShape = new THREE.Shape();
    rightShape.moveTo(0, 1.8);
    rightShape.lineTo(0.65, 1.8);
    rightShape.lineTo(1.65, -1.8);
    rightShape.lineTo(0.95, -1.8);
    rightShape.lineTo(0.35, 0.2);
    rightShape.lineTo(0, 0.2);
    rightShape.closePath();

    const rightGeometry = new THREE.ExtrudeGeometry(rightShape, extrudeSettings);
    rightGeometry.center();
    const rightPylon = new THREE.Mesh(rightGeometry, polishedSilverMaterial);
    rightPylon.position.set(0.65, 0.05, 0);
    emblemGroup.add(rightPylon);

    // C. Recessed Cybernetic Crossbar (Precision Engineered Connector)
    const crossbarGeo = new THREE.BoxGeometry(1.65, 0.26, 0.26);
    const crossbar = new THREE.Mesh(crossbarGeo, cyberConnectorMaterial);
    crossbar.position.set(0, -0.45, 0);
    emblemGroup.add(crossbar);

    // Crossbar Accent Glow Strips
    const stripGeo = new THREE.BoxGeometry(1.67, 0.04, 0.28);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    const stripTop = new THREE.Mesh(stripGeo, stripMat);
    stripTop.position.set(0, -0.32, 0);
    const stripBottom = new THREE.Mesh(stripGeo, stripMat);
    stripBottom.position.set(0, -0.58, 0);
    emblemGroup.add(stripTop);
    emblemGroup.add(stripBottom);

    // D. Integrated 3D Continuous Orbital Gyroscopic Torus
    // Threads through the negative space between the pylons!
    const torusGeo = new THREE.TorusGeometry(2.15, 0.068, 32, 120);
    const orbitalRing = new THREE.Mesh(torusGeo, orbitalRingMaterial);
    // Tilted at a dynamic gyroscopic angle
    orbitalRing.rotation.x = Math.PI / 3.6;
    orbitalRing.rotation.y = Math.PI / 10;
    orbitalRing.rotation.z = -Math.PI / 7;
    orbitalRing.position.set(0, -0.1, 0);
    emblemGroup.add(orbitalRing);

    // Outer Secondary Orbit Tracer (Fine Photonic Filament)
    const outerTorusGeo = new THREE.TorusGeometry(2.45, 0.02, 16, 100);
    const outerTorusMat = new THREE.MeshBasicMaterial({
      color: 0xff3a00,
      transparent: true,
      opacity: 0.65,
    });
    const outerRing = new THREE.Mesh(outerTorusGeo, outerTorusMat);
    outerRing.rotation.x = -Math.PI / 4.2;
    outerRing.rotation.z = Math.PI / 6;
    outerRing.position.set(0, -0.1, 0);
    emblemGroup.add(outerRing);

    // E. Quantum Singularity Core Crystal (Solar Radiant Flare)
    const coreGeo = new THREE.OctahedronGeometry(0.32, 0);
    const quantumCore = new THREE.Mesh(coreGeo, quantumCoreMaterial);
    quantumCore.position.set(0, 0.35, 0);
    emblemGroup.add(quantumCore);

    // F. Apex Photonic Beacon
    const apexBeaconGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const apexBeaconMat = new THREE.MeshBasicMaterial({ color: 0xffa028 });
    const apexBeacon = new THREE.Mesh(apexBeaconGeo, apexBeaconMat);
    apexBeacon.position.set(0, 1.95, 0);
    emblemGroup.add(apexBeacon);

    // Initial Three-Quarter Angle Setup
    emblemGroup.rotation.y = 0.52;
    emblemGroup.rotation.x = 0.15;
    emblemGroup.rotation.z = -0.04;
    scene.add(emblemGroup);

    // 4. Studio Cinematic Lighting Design
    // Ambient Warm Charcoal Fill
    const ambientLight = new THREE.AmbientLight(0x1a0802, 1.5);
    scene.add(ambientLight);

    // Soft White Key Light
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(5, 8, 7);
    scene.add(keyLight);

    // Solar Orange Rim Light (back-left to rake across beveled edges)
    const orangeRimLight = new THREE.PointLight(0xff6a00, 5.5, 25);
    orangeRimLight.position.set(-5, -2, -4);
    scene.add(orangeRimLight);

    // Warm Gold Highlight (right side fill)
    const goldLight = new THREE.DirectionalLight(0xffa500, 3.2);
    goldLight.position.set(6, 3, 4);
    scene.add(goldLight);

    // Deep Crimson and Amber Bottom-Up Reflection
    const crimsonLight = new THREE.PointLight(0xe52500, 4.0, 20);
    crimsonLight.position.set(0, -6, 2);
    scene.add(crimsonLight);

    // Front Subtle Fill Light
    const fillLight = new THREE.PointLight(0xffd080, 1.8, 15);
    fillLight.position.set(0, 2, 5);
    scene.add(fillLight);

    // 5. Atmospheric Background Particles (Neural Dust)
    const particleCount = 220;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 22;
      positions[i + 1] = (Math.random() - 0.5) * 16;
      positions[i + 2] = (Math.random() - 0.5) * 14 - 2;
      scales[i / 3] = Math.random() * 0.05 + 0.02;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.07,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // 6. Scroll & Mouse Tracking Engine
    let currentScroll = 0;
    let targetScroll = 0;
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const heroHeight = container.clientHeight || window.innerHeight;
      // Normalized progress through the hero (0.0 to 1.0)
      const progress = Math.min(Math.max(scrollY / (heroHeight * 1.1), 0), 1);
      targetScroll = progress;
      setScrollPercent(Math.round(progress * 100));
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetMouseX = x * 0.4;
      targetMouseY = y * 0.3;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Handle Resize
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 7. High-Performance Render Loop with Smooth Damped Interpolation (Lerp)
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Lerp scroll progress for ultra-silky motion
      currentScroll += (targetScroll - currentScroll) * 0.085;
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      if (!prefersReducedMotion) {
        // Base Three-Quarter Angle
        const initialY = 0.52;
        const initialX = 0.15;
        const initialZ = -0.04;

        // One choreographed 360-degree rotation across hero scroll
        // Revealing thickness, side geometry, and chamfer bevels
        const scrollRotY = currentScroll * Math.PI * 2.15;
        // Restrained X-axis tilt to showcase bevels and top cuts
        const scrollRotX = Math.sin(currentScroll * Math.PI) * 0.38;
        // Subtle Z-axis perspective modulation
        const scrollRotZ = Math.sin(currentScroll * Math.PI * 2) * 0.12;

        emblemGroup.rotation.y = initialY + scrollRotY + mouseX;
        emblemGroup.rotation.x = initialX + scrollRotX - mouseY;
        emblemGroup.rotation.z = initialZ + scrollRotZ;

        // Scale & Position Docking Transformation during hero scroll
        const targetScale = 1.05 - currentScroll * 0.28;
        emblemGroup.scale.set(targetScale, targetScale, targetScale);

        // Subtle vertical parallax floating
        emblemGroup.position.y = Math.sin(elapsedTime * 1.2) * 0.06 - currentScroll * 0.6;
        emblemGroup.position.x = mouseX * 0.4;

        // Subtle independent idle rotation of the quantum core crystal
        quantumCore.rotation.y = elapsedTime * 0.8;
        quantumCore.rotation.x = elapsedTime * 0.5;

        // Orbital ring subtle energy shimmer
        orbitalRingMaterial.emissiveIntensity = 0.4 + Math.sin(elapsedTime * 2.5) * 0.15;

        // Subtle particle drift
        particles.rotation.y = elapsedTime * 0.02;
      } else {
        // Polished static state for reduced-motion users
        emblemGroup.rotation.y = 0.52;
        emblemGroup.rotation.x = 0.15;
        emblemGroup.rotation.z = -0.04;
        emblemGroup.scale.set(1.0, 1.0, 1.0);
        emblemGroup.position.set(0, 0, 0);
      }

      renderer.render(scene, camera);
    };

    animate();
    if (onLoaded) onLoaded();

    // 8. Proper Cleanup on Unmount (GPU Resources & Listeners)
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', handleScroll);
      container.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();

      // Dispose geometries
      leftGeometry.dispose();
      rightGeometry.dispose();
      crossbarGeo.dispose();
      stripGeo.dispose();
      torusGeo.dispose();
      outerTorusGeo.dispose();
      coreGeo.dispose();
      apexBeaconGeo.dispose();
      particleGeometry.dispose();

      // Dispose materials
      darkTitaniumMaterial.dispose();
      polishedSilverMaterial.dispose();
      cyberConnectorMaterial.dispose();
      orbitalRingMaterial.dispose();
      outerTorusMat.dispose();
      quantumCoreMaterial.dispose();
      apexBeaconMat.dispose();
      stripMat.dispose();
      particleMaterial.dispose();

      // Dispose renderer
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [interactive, prefersReducedMotion, onLoaded]);

  // Fallback for no WebGL support
  if (!webglSupported) {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        <div className="text-center p-8 bg-slate-900/60 rounded-2xl border border-slate-800">
          <div className="w-48 h-48 mx-auto mb-4">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl">
              <polygon points="50,14 35,14 14,84 28,84 41,44 50,44" fill="#94A3B8" />
              <polygon points="50,14 65,14 86,84 72,84 59,44 50,44" fill="#E2E8F0" />
              <polygon points="31,57 69,57 66,65 34,65" fill="#0F172A" stroke="#00F2FE" strokeWidth="1.5" />
              <path d="M 16 54 C 22 36, 52 32, 78 40" stroke="#00F2FE" strokeWidth="4" opacity="0.5" />
              <path d="M 22 66 C 36 82, 64 82, 82 54" stroke="#00F2FE" strokeWidth="5" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm">WebGL is hardware-accelerated. High-resolution vector emblem rendered.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full select-none ${className}`}>
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Telemetry HUD Overlay */}
      <div className="absolute bottom-4 left-6 pointer-events-none hidden sm:flex items-center gap-3 font-mono text-[11px] text-slate-400 bg-slate-950/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-800/80 shadow-lg">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
        <span className="text-slate-300 font-semibold tracking-wider">REAL-TIME 3D EMBLEM</span>
        <span className="text-slate-600">|</span>
        <span className="text-cyan-400">PBR TITANIUM / CHROME</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-300">SCROLL REVEAL: {scrollPercent}%</span>
      </div>

      {/* Scroll indicator prompt */}
      <div className="absolute bottom-4 right-6 pointer-events-none hidden lg:flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-400 bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800/80">
        <svg className="w-3.5 h-3.5 text-cyan-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
        <span>SCROLL TO ROTATE 3D GEOMETRY</span>
      </div>
    </div>
  );
};
