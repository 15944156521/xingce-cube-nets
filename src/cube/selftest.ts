import { foldFaces, oppositePairs, vertexGroups } from "./geometry.ts";
import { NETS, describeShape, loadNet } from "./nets.ts";
import { QUIZZES, auditQuizzes } from "./questions.ts";

const keys = new Map<string, string>();
function canon(faces: { x: number; y: number }[]) {
  const ops = [
    (p: { x: number; y: number }) => ({ x: p.x, y: p.y }),
    (p: { x: number; y: number }) => ({ x: -p.y, y: p.x }),
    (p: { x: number; y: number }) => ({ x: -p.x, y: -p.y }),
    (p: { x: number; y: number }) => ({ x: p.y, y: -p.x }),
    (p: { x: number; y: number }) => ({ x: -p.x, y: p.y }),
    (p: { x: number; y: number }) => ({ x: -p.y, y: -p.x }),
    (p: { x: number; y: number }) => ({ x: p.x, y: -p.y }),
    (p: { x: number; y: number }) => ({ x: p.y, y: p.x }),
  ];
  let best = "";
  for (const op of ops) {
    const pts = faces.map(op);
    const mx = Math.min(...pts.map((p) => p.x));
    const my = Math.min(...pts.map((p) => p.y));
    const key = pts
      .map((p) => `${p.x - mx},${p.y - my}`)
      .sort()
      .join("|");
    if (!best || key < best) best = key;
  }
  return best;
}

let legal = 0;
for (const n of NETS) {
  const faces = loadNet(n.id);
  const fold = foldFaces(faces);
  const shape = describeShape(faces);
  const expectValid = n.family !== "bad";
  if (fold.valid !== expectValid) {
    console.log("VALID MISMATCH", n.id, fold.valid, fold.reason);
  }
  if (expectValid && shape.family !== n.family) {
    console.log("FAMILY", n.id, "got", shape.family, shape.title, "want", n.family);
  }
  if (expectValid) {
    legal++;
    const key = canon(faces);
    if (keys.has(key)) console.log("DUP", n.id, keys.get(key));
    keys.set(key, n.id);
    const pairs = oppositePairs(fold);
    if (pairs.length !== 3) console.log("PAIRS", n.id, pairs.length);
    const badV = vertexGroups(fold).filter((g) => new Set(g.corners.map((c) => c.id)).size !== 3);
    if (badV.length) console.log("VERTS", n.id, badV.length);
    const share = pairs.some((p) => {
      const A = faces.find((f) => f.id === p.a)!;
      const B = faces.find((f) => f.id === p.b)!;
      return Math.abs(A.x - B.x) + Math.abs(A.y - B.y) === 1;
    });
    if (share) console.log("OPP SHARE EDGE", n.id);
  }
  console.log(n.id, fold.valid ? "ok" : "bad", shape.title);
}
console.log("legal unique", legal, keys.size);

const problems = auditQuizzes();
console.log("quiz problems", problems.length ? problems.join("\n") : "none");
console.log("quizzes", QUIZZES.length);
