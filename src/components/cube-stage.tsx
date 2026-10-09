import { useEffect, useRef } from "react";
import type { CanvasTexture, Material, Mesh, MeshStandardMaterial, Object3D, Vector3 } from "three";
import type { Dir, DirCorner, Face, FaceId, FoldResult } from "@/cube/geometry";
import { FACE_HEX, paintFaceCanvas, SEAL } from "@/cube/patterns";

export interface StageSnap {
  faces: Face[];
  fold: FoldResult;
  step: number;
  selected: FaceId | null;
  edge: { id: FaceId; dir: Dir } | null;
  partner: { id: FaceId; dir: Dir } | null;
  corners: { id: FaceId; corner: DirCorner }[];
  inside: boolean;
  onSelect: (id: FaceId) => void;
}

const HINGE: Record<Dir, { axis: "x" | "y"; sign: number; pos: [number, number, number]; child: [number, number, number] }> = {
  E: { axis: "y", sign: 1, pos: [0.5, 0, 0], child: [0.5, 0, 0] },
  W: { axis: "y", sign: -1, pos: [-0.5, 0, 0], child: [-0.5, 0, 0] },
  N: { axis: "x", sign: -1, pos: [0, 0.5, 0], child: [0, 0.5, 0] },
  S: { axis: "x", sign: 1, pos: [0, -0.5, 0], child: [0, -0.5, 0] },
};

/**
 * 3D 折叠。层次铰链和 geometry.ts 里的滚法同一套符号：
 * 东 +90° 绕 Y，西 -90°，北 -90° 绕 X，南 +90°。
 * 图案画在贴图上，网格正向是字母，图案另按 rot 转。
 */
export function CubeStage({ snap }: { snap: StageSnap }) {
  const host = useRef<HTMLDivElement>(null);
  const snapRef = useRef(snap);
  snapRef.current = snap;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let dead = false;
    let dispose = () => {};

    void (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
      if (dead || !host.current) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setClearColor(0xf7f3ea, 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.current.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.touchAction = "none";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.08, 40);
      camera.position.set(3.1, 2.5, 4.2);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.target.set(0, 0, 0);
      controls.update();

      scene.add(new THREE.HemisphereLight(0xfff8ee, 0xc9bfae, 0.95));
      scene.add(new THREE.AmbientLight(0xffffff, 0.35));
      const sun = new THREE.DirectionalLight(0xffffff, 1.15);
      sun.position.set(4, 6, 5);
      scene.add(sun);

      const board = new THREE.Group();
      scene.add(board);

      const barMat = new THREE.MeshBasicMaterial({ color: SEAL, depthTest: false });
      const bars = [0, 1].map(() => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1, 10), barMat);
        m.visible = false;
        m.renderOrder = 3;
        scene.add(m);
        return m;
      });
      const spheres = [0, 1, 2].map(() => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 18, 12),
          new THREE.MeshBasicMaterial({ color: SEAL, depthTest: false }),
        );
        m.visible = false;
        m.renderOrder = 4;
        scene.add(m);
        return m;
      });

      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const meshes = new Map<string, Mesh>();
      const hinges = new Map<string, Object3D>();
      let structureKey = "";
      let paintKey = "";
      let sawInside = false;
      const savedPos = new THREE.Vector3();

      const resize = () => {
        const w = host.current?.clientWidth || 320;
        const h = host.current?.clientHeight || 280;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(host.current);
      resize();

      const paintMesh = (mesh: Mesh, face: Face, selected: boolean, bad: boolean) => {
        const canvas = mesh.userData.canvas as HTMLCanvasElement;
        paintFaceCanvas(canvas, face.pattern, face.rot, face.id, FACE_HEX[face.id] ?? "#ddd", selected, bad);
        const tex = mesh.userData.tex as CanvasTexture;
        tex.needsUpdate = true;
        const rim = mesh.userData.rim as Mesh;
        rim.visible = selected;
      };

      const rebuild = (s: StageSnap) => {
        for (const m of meshes.values()) {
          m.geometry.dispose();
          const mat = m.material as MeshStandardMaterial;
          mat.map?.dispose();
          mat.dispose();
          (m.userData.rim as Mesh).geometry.dispose();
          ((m.userData.rim as Mesh).material as Material).dispose();
        }
        board.clear();
        meshes.clear();
        hinges.clear();

        const make = (face: Face) => {
          const canvas = document.createElement("canvas");
          canvas.width = 256;
          canvas.height = 256;
          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          const mat = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.78,
            metalness: 0.02,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
          const rim = new THREE.Mesh(
            new THREE.PlaneGeometry(0.98, 0.98),
            new THREE.MeshBasicMaterial({ color: SEAL, side: THREE.DoubleSide }),
          );
          rim.position.z = -0.012;
          rim.visible = false;
          mesh.add(rim);
          mesh.userData.faceId = face.id;
          mesh.userData.canvas = canvas;
          mesh.userData.tex = tex;
          mesh.userData.rim = rim;
          const bad = s.fold.collisions.includes(face.id);
          paintMesh(mesh, face, face.id === s.selected, bad);
          meshes.set(face.id, mesh);
          return mesh;
        };

        const placed = new Set(s.fold.order);
        const rootId = s.fold.order[0];
        const byParent = new Map<string, { id: FaceId; dir: Dir }[]>();
        for (const [id, p] of s.fold.parent) {
          if (!p) continue;
          const list = byParent.get(p.id) ?? [];
          list.push({ id, dir: p.dir });
          byParent.set(p.id, list);
        }

        const attachKids = (holder: Object3D, id: FaceId) => {
          for (const kid of byParent.get(id) ?? []) {
            const spec = HINGE[kid.dir];
            const hinge = new THREE.Group();
            hinge.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
            const pivot = new THREE.Group();
            pivot.position.set(spec.child[0], spec.child[1], spec.child[2]);
            const face = s.faces.find((f) => f.id === kid.id);
            if (!face) continue;
            pivot.add(make(face));
            hinge.add(pivot);
            holder.add(hinge);
            hinges.set(kid.id, hinge);
            hinge.userData.axis = spec.axis;
            hinge.userData.sign = spec.sign;
            attachKids(pivot, kid.id);
          }
        };

        if (rootId) {
          const rootFace = s.faces.find((f) => f.id === rootId);
          if (rootFace) {
            const pivot = new THREE.Group();
            pivot.position.set(rootFace.x, rootFace.y, 0);
            pivot.add(make(rootFace));
            board.add(pivot);
            attachKids(pivot, rootId);
          }
        }
        for (const face of s.faces) {
          if (placed.has(face.id)) continue;
          const mesh = make(face);
          mesh.position.set(face.x, face.y, 0);
          board.add(mesh);
        }
      };

      const angleOf = (id: string, s: StageSnap) => {
        const idx = s.fold.order.indexOf(id as FaceId);
        if (idx <= 0) return 0;
        const k = idx - 1;
        if (k < Math.floor(s.step)) return 90;
        if (k === Math.floor(s.step)) return (s.step - k) * 90;
        return 0;
      };

      let downX = 0;
      let downY = 0;
      let dragged = false;
      const onDown = (ev: PointerEvent) => {
        downX = ev.clientX;
        downY = ev.clientY;
        dragged = false;
      };
      const onMove = (ev: PointerEvent) => {
        if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 5) dragged = true;
      };
      const onUp = (ev: PointerEvent) => {
        if (dragged || snapRef.current.inside) return;
        const rect = renderer.domElement.getBoundingClientRect();
        ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObjects([...meshes.values()], false)[0];
        const id = hit?.object.userData.faceId as FaceId | undefined;
        if (id) snapRef.current.onSelect(id);
      };
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerup", onUp);

      const loop = () => {
        const s = snapRef.current;
        const sk = s.faces.map((f) => `${f.id}@${f.x},${f.y}`).join("|") + ":" + s.fold.order.join("");
        if (sk !== structureKey) {
          structureKey = sk;
          paintKey = "";
          rebuild(s);
        }
        const pk = s.faces.map((f) => `${f.id}${f.pattern}${f.rot}${f.id === s.selected ? 1 : 0}${s.fold.collisions.includes(f.id) ? 1 : 0}`).join();
        if (pk !== paintKey) {
          paintKey = pk;
          for (const f of s.faces) {
            const mesh = meshes.get(f.id);
            if (mesh) paintMesh(mesh, f, f.id === s.selected, s.fold.collisions.includes(f.id));
          }
        }
        let sum = 0;
        let nH = 0;
        for (const [id, hinge] of hinges) {
          const ang = (angleOf(id, s) * Math.PI) / 180;
          const sign = hinge.userData.sign as number;
          if (hinge.userData.axis === "y") hinge.rotation.y = sign * ang;
          else hinge.rotation.x = sign * ang;
          sum += angleOf(id, s);
          nH += 1;
        }
        const cx = s.faces.reduce((a, f) => a + f.x, 0) / Math.max(1, s.faces.length);
        const cy = s.faces.reduce((a, f) => a + f.y, 0) / Math.max(1, s.faces.length);
        const lift = nH ? (sum / nH / 90) * 0.45 : 0;
        board.position.set(-cx, -cy, lift);
        board.updateMatrixWorld(true);

        const placeBar = (bar: Mesh, a: Vector3, b: Vector3) => {
          const mid = a.clone().add(b).multiplyScalar(0.5);
          const dir = b.clone().sub(a);
          const len = dir.length() || 1;
          bar.visible = true;
          bar.position.copy(mid);
          bar.scale.set(1, len, 1);
          bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.multiplyScalar(1 / len));
        };
        bars.forEach((b) => (b.visible = false));
        const showEdge = (slot: number, id: FaceId, dir: Dir) => {
          const mesh = meshes.get(id);
          if (!mesh) return;
          const h = 0.45;
          const z = 0.03;
          const seg =
            dir === "N"
              ? [new THREE.Vector3(-h, h, z), new THREE.Vector3(h, h, z)]
              : dir === "S"
                ? [new THREE.Vector3(-h, -h, z), new THREE.Vector3(h, -h, z)]
                : dir === "E"
                  ? [new THREE.Vector3(h, -h, z), new THREE.Vector3(h, h, z)]
                  : [new THREE.Vector3(-h, -h, z), new THREE.Vector3(-h, h, z)];
          seg[0]!.applyMatrix4(mesh.matrixWorld);
          seg[1]!.applyMatrix4(mesh.matrixWorld);
          const bar = bars[slot];
          if (bar) placeBar(bar, seg[0]!, seg[1]!);
        };
        if (s.edge) showEdge(0, s.edge.id, s.edge.dir);
        if (s.partner) showEdge(1, s.partner.id, s.partner.dir);

        spheres.forEach((sp) => (sp.visible = false));
        s.corners.slice(0, 3).forEach((c, i) => {
          const mesh = meshes.get(c.id);
          const sp = spheres[i];
          if (!mesh || !sp) return;
          const h = 0.45;
          const v =
            c.corner === "NE"
              ? new THREE.Vector3(h, h, 0.04)
              : c.corner === "NW"
                ? new THREE.Vector3(-h, h, 0.04)
                : c.corner === "SE"
                  ? new THREE.Vector3(h, -h, 0.04)
                  : new THREE.Vector3(-h, -h, 0.04);
          v.applyMatrix4(mesh.matrixWorld);
          sp.visible = true;
          sp.position.copy(v);
        });

        if (s.inside && !sawInside) {
          savedPos.copy(camera.position);
          controls.enabled = false;
          camera.near = 0.02;
          camera.position.set(0, 0, 0);
          camera.lookAt(0, 0, 1);
          camera.updateProjectionMatrix();
        } else if (!s.inside && sawInside) {
          controls.enabled = true;
          camera.near = 0.08;
          camera.position.copy(savedPos);
          camera.updateProjectionMatrix();
          controls.target.set(0, 0, 0);
        }
        sawInside = s.inside;
        if (!s.inside) controls.update();
        renderer.render(scene, camera);
      };
      renderer.setAnimationLoop(loop);

      dispose = () => {
        renderer.setAnimationLoop(null);
        ro.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onDown);
        renderer.domElement.removeEventListener("pointermove", onMove);
        renderer.domElement.removeEventListener("pointerup", onUp);
        controls.dispose();
        rebuild({ ...snapRef.current, faces: [], fold: { ...snapRef.current.fold, order: [], parent: new Map(), collisions: [] } });
        barMat.dispose();
        bars.forEach((b) => b.geometry.dispose());
        spheres.forEach((sp) => {
          sp.geometry.dispose();
          (sp.material as Material).dispose();
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      dead = true;
      dispose();
    };
  }, []);

  return <div ref={host} className="h-full min-h-72 w-full" />;
}
