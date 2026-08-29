import { useEffect, useRef, useState } from "react";

// Real-time viewer for the FLX-HUB-1 enclosure STLs — matte black,
// studio-lit, slow turn, drag to inspect. three.js loads lazily so
// it costs nothing until this card is actually on screen.
const PARTS = [
  { key: "base", label: "Base", file: "/hardware/flx-hub-1-base.stl" },
  { key: "lid", label: "Lid", file: "/hardware/flx-hub-1-lid.stl" },
] as const;

export function CaseViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [part, setPart] = useState<(typeof PARTS)[number]>(PARTS[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let frame = 0;
    let cleanup: (() => void) | null = null;

    (async () => {
      setLoading(true);
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
      if (disposed || !mountRef.current) return;

      const w = mount.clientWidth;
      const h = 340;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      mount.innerHTML = "";
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, w / h, 1, 2000);

      // studio: soft ambient, warm key, cool rim — the moonlight look
      scene.add(new THREE.HemisphereLight(0x4a4e55, 0x0c0d0f, 1.6));
      const key = new THREE.DirectionalLight(0xf4f3f0, 3.0);
      key.position.set(120, 180, 160);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x9ab0c9, 1.2);
      rim.position.set(-160, 60, -120);
      scene.add(rim);
      const fill = new THREE.DirectionalLight(0xdddcd5, 0.7);
      fill.position.set(-60, -80, 140);
      scene.add(fill);

      const material = new THREE.MeshPhysicalMaterial({
        color: 0x212429,
        roughness: 0.62,
        metalness: 0.08,
        clearcoat: 0.3,
        clearcoatRoughness: 0.5,
      });

      const group = new THREE.Group();
      scene.add(group);

      const loader = new STLLoader();
      loader.load(part.file, (geometry) => {
        if (disposed) return;
        geometry.computeVertexNormals();
        geometry.center();
        const mesh = new THREE.Mesh(geometry, material);
        // STL is Z-up; show it face-up, slightly tilted
        mesh.rotation.x = -Math.PI / 2;
        group.add(mesh);

        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3()).length();
        camera.position.set(size * 0.7, size * 0.5, size * 0.85);
        camera.lookAt(0, 0, 0);
        setLoading(false);
      });

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.1;
      controls.minDistance = 60;
      controls.maxDistance = 600;

      const onResize = () => {
        const nw = mount.clientWidth;
        camera.aspect = nw / h;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, h);
      };
      window.addEventListener("resize", onResize);

      const animate = () => {
        frame = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", onResize);
        controls.dispose();
        renderer.dispose();
        mount.innerHTML = "";
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [part]);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        {PARTS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPart(p)}
            className={`text-xs font-mono rounded-lg px-3 py-1 border transition-colors ${
              part.key === p.key
                ? "border-brass text-brass"
                : "border-line text-faint hover:text-mute hover:border-brassdim"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-auto text-faint text-[10px] font-mono">drag to inspect · scroll to zoom</span>
      </div>
      <div
        className="rounded-xl border border-line bg-[radial-gradient(120%_120%_at_30%_20%,#101214_0%,#0a0b0d_70%)] overflow-hidden relative"
        style={{ height: 340 }}
      >
        {/* three.js owns this div exclusively — React never renders into it */}
        <div ref={mountRef} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-faint text-xs font-mono pointer-events-none">
            loading the real geometry…
          </div>
        )}
      </div>
    </div>
  );
}
