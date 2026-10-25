"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TopographyBackground } from "@/components/ui/topography-bg";

/** Одноразовая «волна» от формы входа: ошибка — красная, успех — зелёная */
export type Pulse = { id: number; tone: "error" | "success" } | null;

const vertex = /* glsl */ `
uniform float uTime;
uniform vec2 uMouse;
uniform vec3 uRipple; // xy — центр волны, z — время старта
varying float vH;
varying float vDist;
varying vec2 vXZ;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; }
  return v;
}
void main(){
  vec3 p = position;
  float h = fbm(p.xz * 0.12 + vec2(uTime * 0.02, -uTime * 0.015)) * 3.2;

  // холм под курсором
  float d = distance(p.xz, uMouse);
  h += 2.4 * exp(-d * d * 0.06);

  // кольцевая волна
  float rt = uTime - uRipple.z;
  float rd = distance(p.xz, uRipple.xy);
  float front = rd - rt * 9.0;
  h += 1.3 * sin(front * 1.1) * exp(-rt * 1.1) * exp(-abs(front) * 0.35) * step(0.0, rt);

  p.y = h;
  vH = h; vXZ = p.xz; vDist = d;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const fragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uTint;
uniform float uTintAmt;
varying float vH;
varying float vDist;
varying vec2 vXZ;

void main(){
  float f = vH * 3.0;
  float minor = 1.0 - smoothstep(0.0, 1.2, abs(fract(f - 0.5) - 0.5) / max(fwidth(f), 1e-4));
  float f5 = f / 5.0;
  float major = 1.0 - smoothstep(0.0, 1.6, abs(fract(f5 - 0.5) - 0.5) / max(fwidth(f5), 1e-4));

  float edge = 1.0 - smoothstep(8.0, 28.0, length(vXZ));
  float glow = exp(-vDist * vDist * 0.05);

  vec3 col = mix(uColor, vec3(0.78, 0.9, 1.0), glow);
  col = mix(col, uTint, uTintAmt);
  float a = (minor * 0.32 + major * 0.55 + glow * minor * 0.6) * edge;
  gl_FragColor = vec4(col, a);
}`;

export default function Terrain3DBackground({ pulse = null, ambient = false }: { pulse?: Pulse; ambient?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ pulse: (tone: "error" | "success") => void } | null>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    setWebgl(!!document.createElement("canvas").getContext("webgl2"));
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!webgl || !el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, ambient ? 1 : 1.75));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 120);

    const geometry = new THREE.PlaneGeometry(64, 64, ambient ? 140 : 220, ambient ? 140 : 220);
    geometry.rotateX(-Math.PI / 2);
    const u = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(6, 0) },
      uRipple: { value: new THREE.Vector3(0, 0, -1000) },
      uColor: { value: new THREE.Color("#3b82f6") },
      uTint: { value: new THREE.Color("#ef4444") },
      uTintAmt: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: u,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const ndc = new THREE.Vector2(0.35, -0.1); // курсор (−1…1)
    const soft = ndc.clone(); // сглаженное значение
    const hit = new THREE.Vector3();
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const aim = () => {
      camera.position.set(soft.x * 1.8, 7 + soft.y * 0.9, 12);
      camera.lookAt(0, 0.4, -3);
      camera.updateMatrixWorld();
    };
    aim();

    api.current = {
      pulse: (tone) => {
        ray.setFromCamera(new THREE.Vector2(0.45, -0.05), camera); // где примерно форма
        if (ray.ray.intersectPlane(plane, hit)) u.uRipple.value.set(hit.x, hit.z, u.uTime.value);
        u.uTint.value.set(tone === "error" ? "#ef4444" : "#22c55e");
        u.uTintAmt.value = 1;
        if (reduced) renderer.render(scene, camera);
      },
    };

    const onResize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      if (reduced) renderer.render(scene, camera);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const onMove = (e: PointerEvent) =>
      ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const onDown = () => u.uRipple.value.set(u.uMouse.value.x, u.uMouse.value.y, u.uTime.value);

    if (reduced) {
      renderer.render(scene, camera);
    } else {
      window.addEventListener("pointermove", onMove);
      if (!ambient) window.addEventListener("pointerdown", onDown);
      let last = performance.now();
      let lastDraw = 0;
      const frame = (now: number) => {
        if (ambient && now - lastDraw < 33) { // в дашборде ~30 fps, чтобы не греть ноутбук
          raf = requestAnimationFrame(frame);
          return;
        }
        lastDraw = now;
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        u.uTime.value += dt;
        soft.lerp(ndc, 1 - Math.exp(-dt * 3));
        aim();

        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(plane, hit)) {
          const k = 1 - Math.exp(-dt * 6);
          u.uMouse.value.x += (hit.x - u.uMouse.value.x) * k;
          u.uMouse.value.y += (hit.z - u.uMouse.value.y) * k;
        }
        u.uTintAmt.value *= Math.exp(-dt * 1.4);

        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      api.current = null;
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [webgl, ambient]);

  useEffect(() => {
    if (pulse) api.current?.pulse(pulse.tone);
  }, [pulse]);

  if (webgl === false) return <TopographyBackground />;

  return (
    <div
      ref={host}
      aria-hidden
      className={`fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_70%_40%,#0b1226_0%,#050505_72%)] ${ambient ? "opacity-50" : ""}`}
    />
  );
}
