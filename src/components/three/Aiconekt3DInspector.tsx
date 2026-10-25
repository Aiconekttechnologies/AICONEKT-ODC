import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCw, Eye, Sun, Box, RefreshCw } from 'lucide-react';

export const Aiconekt3DInspector: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState(false);
  const [materialTheme, setMaterialTheme] = useState<'titanium' | 'chrome' | 'obsidian'>('titanium');
  const [lightingPreset, setLightingPreset] = useState<'studio' | 'cyber' | 'monochrome'>('studio');
  const [autoRotate, setAutoRotate] = useState(true);

  const materialsRef = useRef<{
    leftMat?: THREE.MeshStandardMaterial;
    rightMat?: THREE.MeshStandardMaterial;
    crossbarMat?: THREE.MeshStandardMaterial;
    torusMat?: THREE.MeshPhysicalMaterial;
  }>({});

  const lightsRef = useRef<{
    cyanLight?: THREE.PointLight;
    cobaltLight?: THREE.DirectionalLight;
    violetLight?: THREE.PointLight;
    keyLight?: THREE.DirectionalLight;
  }>({});

  const sceneGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050714, 0.04);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 0, 7.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Group
    const group = new THREE.Group();
    sceneGroupRef.current = group;

    // Materials (Official Orange-to-Red Orbital A Identity)
    const leftMat = new THREE.MeshStandardMaterial({
      color: 0xff7a00,
      metalness: 0.88,
      roughness: 0.22,
      wireframe,
    });
    const rightMat = new THREE.MeshStandardMaterial({
      color: 0xd62000,
      metalness: 0.92,
      roughness: 0.16,
      wireframe,
    });
    const crossbarMat = new THREE.MeshStandardMaterial({
      color: 0x240600,
      metalness: 0.8,
      roughness: 0.35,
      wireframe,
    });
    const torusMat = new THREE.MeshPhysicalMaterial({
      color: 0xff9900,
      emissive: 0xff3b00,
      emissiveIntensity: 0.7,
      roughness: 0.08,
      metalness: 0.95,
      wireframe,
    });

    materialsRef.current = { leftMat, rightMat, crossbarMat, torusMat };

    // Geometries
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

    const leftGeo = new THREE.ExtrudeGeometry(leftShape, extrudeSettings);
    leftGeo.center();
    const leftMesh = new THREE.Mesh(leftGeo, leftMat);
    leftMesh.position.set(-0.65, 0.05, 0);
    group.add(leftMesh);

    const rightShape = new THREE.Shape();
    rightShape.moveTo(0, 1.8);
    rightShape.lineTo(0.65, 1.8);
    rightShape.lineTo(1.65, -1.8);
    rightShape.lineTo(0.95, -1.8);
    rightShape.lineTo(0.35, 0.2);
    rightShape.lineTo(0, 0.2);
    rightShape.closePath();

    const rightGeo = new THREE.ExtrudeGeometry(rightShape, extrudeSettings);
    rightGeo.center();
    const rightMesh = new THREE.Mesh(rightGeo, rightMat);
    rightMesh.position.set(0.65, 0.05, 0);
    group.add(rightMesh);

    const crossbarGeo = new THREE.BoxGeometry(1.65, 0.26, 0.26);
    const crossbar = new THREE.Mesh(crossbarGeo, crossbarMat);
    crossbar.position.set(0, -0.45, 0);
    group.add(crossbar);

    const torusGeo = new THREE.TorusGeometry(2.15, 0.068, 32, 120);
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI / 3.6;
    torus.rotation.y = Math.PI / 10;
    torus.rotation.z = -Math.PI / 7;
    torus.position.set(0, -0.1, 0);
    group.add(torus);

    const coreGeo = new THREE.OctahedronGeometry(0.32, 0);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0xffe6b8,
      emissive: 0xff7700,
      emissiveIntensity: 0.95,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 0.35, 0);
    group.add(core);

    scene.add(group);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x1a0802, 1.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(5, 8, 7);
    scene.add(keyLight);

    const cyanLight = new THREE.PointLight(0xff6a00, 5.0, 25);
    cyanLight.position.set(-5, -2, -4);
    scene.add(cyanLight);

    const cobaltLight = new THREE.DirectionalLight(0xffa500, 3.0);
    cobaltLight.position.set(6, 3, 4);
    scene.add(cobaltLight);

    const violetLight = new THREE.PointLight(0xe52500, 4.0, 20);
    violetLight.position.set(0, -6, 2);
    scene.add(violetLight);

    lightsRef.current = { cyanLight, cobaltLight, violetLight, keyLight };

    // Mouse Drag Rotation Controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !group) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      group.rotation.y += deltaX * 0.008;
      group.rotation.x += deltaY * 0.008;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Resize
    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // Animate
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (autoRotate && !isDragging) {
        group.rotation.y += delta * 0.55;
      }
      core.rotation.y += delta * 1.2;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);

      leftGeo.dispose();
      rightGeo.dispose();
      crossbarGeo.dispose();
      torusGeo.dispose();
      coreGeo.dispose();

      leftMat.dispose();
      rightMat.dispose();
      crossbarMat.dispose();
      torusMat.dispose();
      coreMat.dispose();

      renderer.dispose();
      if (domElement && container.contains(domElement)) {
        container.removeChild(domElement);
      }
    };
  }, [wireframe, autoRotate]);

  // Handle Material Changes
  useEffect(() => {
    const { leftMat, rightMat, torusMat } = materialsRef.current;
    if (!leftMat || !rightMat || !torusMat) return;

    if (materialTheme === 'titanium') {
      leftMat.color.setHex(0x1e293b);
      leftMat.metalness = 0.88;
      leftMat.roughness = 0.24;
      rightMat.color.setHex(0xe2e8f0);
      rightMat.metalness = 0.95;
      rightMat.roughness = 0.12;
      torusMat.color.setHex(0x00f2fe);
      torusMat.emissive.setHex(0x00f2fe);
    } else if (materialTheme === 'chrome') {
      leftMat.color.setHex(0xffffff);
      leftMat.metalness = 0.98;
      leftMat.roughness = 0.05;
      rightMat.color.setHex(0xf8fafc);
      rightMat.metalness = 0.98;
      rightMat.roughness = 0.05;
      torusMat.color.setHex(0x38bdf8);
      torusMat.emissive.setHex(0x2563eb);
    } else if (materialTheme === 'obsidian') {
      leftMat.color.setHex(0x090d16);
      leftMat.metalness = 0.6;
      leftMat.roughness = 0.35;
      rightMat.color.setHex(0x1e293b);
      rightMat.metalness = 0.7;
      rightMat.roughness = 0.25;
      torusMat.color.setHex(0x8b5cf6);
      torusMat.emissive.setHex(0x8b5cf6);
    }
  }, [materialTheme]);

  // Handle Lighting Changes
  useEffect(() => {
    const { cyanLight, cobaltLight, violetLight, keyLight } = lightsRef.current;
    if (!cyanLight || !cobaltLight || !violetLight || !keyLight) return;

    if (lightingPreset === 'studio') {
      cyanLight.intensity = 5.0;
      cobaltLight.intensity = 3.0;
      violetLight.intensity = 4.0;
      keyLight.intensity = 2.2;
    } else if (lightingPreset === 'cyber') {
      cyanLight.intensity = 8.0;
      cobaltLight.intensity = 5.5;
      violetLight.intensity = 7.0;
      keyLight.intensity = 0.8;
    } else if (lightingPreset === 'monochrome') {
      cyanLight.intensity = 0.5;
      cobaltLight.intensity = 1.0;
      violetLight.intensity = 0.5;
      keyLight.intensity = 3.5;
    }
  }, [lightingPreset]);

  const resetOrientation = () => {
    if (sceneGroupRef.current) {
      sceneGroupRef.current.rotation.set(0.15, 0.52, -0.04);
    }
  };

  return (
    <div className="relative w-full h-[520px] bg-slate-950/80 rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* 3D Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Header / Status */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span>INTERACTIVE 3D CAD INSPECTOR</span>
        </div>
        <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 font-mono">
          DRAG TO ROTATE 360° IN REAL TIME
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-800/90 shadow-xl">
        {/* Rotation & Wireframe */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              autoRotate ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            <span>{autoRotate ? 'Auto-Orbit: ON' : 'Orbit: PAUSED'}</span>
          </button>

          <button
            onClick={() => setWireframe(!wireframe)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              wireframe ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Wireframe: {wireframe ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={resetOrientation}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Reset to Hero 3/4 Angle"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset View</span>
          </button>
        </div>

        {/* Material & Lighting Switchers */}
        <div className="flex items-center gap-3">
          {/* Material */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg">
            <span className="text-[10px] font-mono text-slate-400 px-1.5">MAT:</span>
            <button
              onClick={() => setMaterialTheme('titanium')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                materialTheme === 'titanium' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Titanium
            </button>
            <button
              onClick={() => setMaterialTheme('chrome')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                materialTheme === 'chrome' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Chrome
            </button>
            <button
              onClick={() => setMaterialTheme('obsidian')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                materialTheme === 'obsidian' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Obsidian
            </button>
          </div>

          {/* Lighting */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg hidden sm:flex">
            <span className="text-[10px] font-mono text-slate-400 px-1.5">LIGHT:</span>
            <button
              onClick={() => setLightingPreset('studio')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                lightingPreset === 'studio' ? 'bg-blue-500 text-white font-semibold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Studio
            </button>
            <button
              onClick={() => setLightingPreset('cyber')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                lightingPreset === 'cyber' ? 'bg-violet-500 text-white font-semibold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Cyber
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
