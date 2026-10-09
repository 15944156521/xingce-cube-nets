import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  arrowPointsTo,
  explainClock,
  explainEdge,
  explainVertex,
  foldFaces,
  legalMoves,
  oppositeOf,
  partnerEdge,
  tripleMeets,
  tryMoveFace,
  vertexGroups,
  type Dir,
  type Face,
  type FaceId,
  type PatternId,
} from "@/cube/geometry";
import { DEMOS, describeShape, loadNet, NETS, netById } from "@/cube/nets";
import { PATTERN_LIST } from "@/cube/patterns";
import { QUIZZES, quizFromFaces, type Quiz } from "@/cube/questions";
import { CubeStage } from "@/components/cube-stage";
import { MiniCube } from "@/components/mini-cube";
import { NetBoard, NetThumb } from "@/components/net-board";

type LessonId = "nets" | "opposite" | "edge" | "vertex" | "move" | "clock" | "flow" | "drill";
type Tool = "none" | "move" | "edge" | "vertex" | "clock";

const LESSONS: {
  id: LessonId;
  name: string;
  mnemonic: string;
  def: string;
  rules: string[];
}[] = [
  {
    id: "nets",
    name: "十一种展开图",
    mnemonic: "一四一呈六种，二三一有三种，二二二与三三各一种。没有凹和田。",
    def: "沿棱剪开、不重叠也不悬空的六连方，旋转翻转后一共 11 种。按最长的直带分成四族。",
    rules: [
      "141：四连为带，两侧各一面，合法摆法 6 种。两个侧边在同一侧、又贴在两头，会叠到同一个面。",
      "132 / 231：三连为带，一侧一个、一侧两个，共 3 种。从「1」那头读是 132，从「2」那头读是 231，是同一族。",
      "222：只有阶梯一种。没有三连，相对面全靠 Z 字。",
      "33：两个三连只错开一条边，只有 1 种。实心的 2×3「日」字不能折。",
      "反例：田字、凹字、实心日字、只在顶点相接。这些折起来都会重叠或散开。",
    ],
  },
  {
    id: "opposite",
    name: "相对面",
    mnemonic: "相间、Z 端是对面。相对两面绝不共边。",
    def: "折成正方体后没有公共棱的那一对。六个面配成三对。",
    rules: [
      "同行或同列，中间正好隔一个面，两端相对。",
      "Z 字两端相对。S 形、躺着的、竖着的，都算。",
      "上面两条都看不出时：折完既不相邻、又不是同一面，就只能是相对。",
      "铁律：相对面在展开图上不会共用一条边。看见共边，一定不是对面。",
    ],
  },
  {
    id: "edge",
    name: "公共边",
    mnemonic: "先定棱，再看图案贴的是不是这条棱。",
    def: "折叠之后重合成同一条棱的两条边，叫公共边。",
    rules: [
      "展开图上已经粘在一起的，折完还是这条棱。",
      "看起来挨着、中间却隔着空，或者只是头对头，折完常常是分开的。点两条边，右侧直接判定。",
      "画边法：在一个面上选定基准边（标成 1 北、2 东、3 南、4 西），程序把折完重合的另一条边涂成同色。",
      "箭头、对角线、「上」都要先问：它指向的是哪一条公共边，边外又是哪个面。",
    ],
  },
  {
    id: "vertex",
    name: "公共点",
    mnemonic: "三个面交于一点，角要能同时对上。",
    def: "立方体的一个顶点，由三个面各贡献一个角。",
    rules: [
      "点展开图上的一个角，会标出折完落到同一点的所有角，通常是三个。",
      "立体上这个点同时高亮。选项里三个图案的角必须都能落到这里。",
      "相对面不会来参加这个点，因为相对面连棱都不共。",
    ],
  },
  {
    id: "move",
    name: "移块法",
    mnemonic: "移块不改相对关系，只改你从哪一边看。",
    def: "把一个面绕公共边滚到另一个空位。格子变了，折出来的正方体还是原来那个。",
    rules: [
      "虚线格是滚过去仍然等价的位置。拖到别的格，重叠或悬空会被拒绝，并写明原因。",
      "每滚一次，相对面、公共边、图案朝向都重新算。字母对不会变。",
      "经典：十字 141 滚两下变成 132；阶梯 222 滚一下，就会出现「同行隔一面」。",
      "不许滚成镜像。从内部看才是翻面，那不是移块。",
    ],
  },
  {
    id: "clock",
    name: "时针法",
    mnemonic: "内外相反。做题一律从立方体外面看。",
    def: "三个两两相邻的面绕公共顶点读顺序，用来核对箭头、对角线和汉字的朝向。",
    rules: [
      "先点一个三面相交的顶点，或依次点三个面。",
      "从纸的正面读到的顺时针，必须和从立方体外部看到的一致。",
      "切到「内部」，顺序整个反过来。这是最常见的错：人站到了盒子里面。",
      "箭头折完指向哪条棱、哪个邻面，右侧会跟着写出来。",
    ],
  },
  {
    id: "flow",
    name: "排除法",
    mnemonic: "对面、棱、点、针。四步走完再落笔。",
    def: "行测里不要同时看四个选项。按固定顺序，排除一条就划掉一个。",
    rules: [
      "① 先找相对面。选项把相对面画成相邻，直接排除。",
      "② 再定公共边。图案贴错边，排除。",
      "③ 再用公共点核对三个面的交角。",
      "④ 最后用时针核对朝向。镜像就是内部视角。",
    ],
  },
  {
    id: "drill",
    name: "练习",
    mnemonic: "先对面，再棱，再点，最后针。",
    def: "十二道分型例题，都是行测的问法，不是教材上的原题。做的时候展开图可以折、可以点。",
    rules: [
      "相对面排除、Z 字、公共边贴错、公共点对不上、箭头反了、移块后仍等价、非法展开干扰，都有。",
      "四个立体选项是同一观察方向。非法那一题改成四张展开图里选不能折的。",
      "自己出题：在展开图上贴图案，再生成一个正确折法让自己判断。",
    ],
  },
];

const GUIDE = [
  "先看 11 种合法图。顶栏可以切换，非法图折的时候会直接说明重叠或悬空。",
  "点一个面。右侧写出它的相对面，并说明用的是隔一面、Z 字，还是折后不相邻。",
  "打开移块，把一面滚进虚线格。形状变了，相对的字母不变。",
  "点折叠。拖动右侧立方体旋转，核对刚才标出的面、棱和点。",
];

const STEP_LABEL = {
  opposite: "① 相对面",
  edge: "② 公共边",
  vertex: "③ 公共点",
  clock: "④ 时针",
} as const;

function sampleNet(id: string): Face[] {
  return loadNet(id);
}

export function CubeApp() {
  const [netId, setNetId] = useState("141-22");
  const [faces, setFaces] = useState<Face[]>(() => sampleNet("141-22"));
  const [lesson, setLesson] = useState<LessonId>("nets");
  const [tool, setTool] = useState<Tool>("none");
  const [selected, setSelected] = useState<FaceId | null>(null);
  const [edge, setEdge] = useState<{ id: FaceId; dir: Dir } | null>(null);
  const [vertexKey, setVertexKey] = useState<string | null>(null);
  const [clockPick, setClockPick] = useState<FaceId[]>([]);
  const [inside, setInside] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playDir, setPlayDir] = useState<1 | -1>(1);
  const [note, setNote] = useState<string | null>(null);
  const [guide, setGuide] = useState<number | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lock, setLock] = useState(false);
  const [stepsOn, setStepsOn] = useState({ opposite: true, edge: true, vertex: true, clock: true });

  const fold = useMemo(() => foldFaces(faces), [faces]);
  const maxStep = Math.max(1, fold.order.length - 1);
  const shape = useMemo(() => describeShape(faces), [faces]);
  const lessonMeta = LESSONS.find((l) => l.id === lesson)!;
  const partner = edge ? partnerEdge(fold, edge) : null;
  const groups = useMemo(() => vertexGroups(fold), [fold]);
  const vGroup = groups.find((g) => g.key === vertexKey) ?? null;
  const clockGroup =
    vGroup && vGroup.corners.length >= 3
      ? vGroup
      : clockPick.length === 3
        ? tripleMeets(fold, clockPick)
        : null;

  const ghosts = useMemo(() => {
    if (tool !== "move" || !selected || lock) return [];
    return legalMoves(faces).filter((m) => m.id === selected);
  }, [tool, selected, faces, lock]);

  useEffect(() => {
    try {
      if (!localStorage.getItem("cube-guide-v1")) setGuide(0);
    } catch {
      setGuide(0);
    }
  }, []);

  useEffect(() => {
    if (guide === null) return;
    const t = window.setTimeout(() => {
      setGuide((g) => {
        if (g === null) return null;
        if (g >= 3) {
          try {
            localStorage.setItem("cube-guide-v1", "1");
          } catch {
            /* ignore */
          }
          return null;
        }
        return g + 1;
      });
    }, 15000);
    return () => window.clearTimeout(t);
  }, [guide]);

  useEffect(() => {
    if (guide === 2) setTool("move");
    if (guide === 3) {
      setPlayDir(1);
      setPlaying(true);
    }
  }, [guide]);

  useEffect(() => {
    if (!playing) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStep(playDir > 0 ? maxStep : 0);
      setPlaying(false);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setStep((s) => {
        const n = s + playDir * dt * 1.35;
        if (n >= maxStep) return maxStep;
        if (n <= 0) return 0;
        return n;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, playDir, maxStep]);

  useEffect(() => {
    if (!playing) return;
    if ((playDir > 0 && step >= maxStep) || (playDir < 0 && step <= 0)) setPlaying(false);
  }, [playing, step, playDir, maxStep]);

  function load(id: string, patterned = false) {
    const next = loadNet(id).map((f, i) => {
      if (!patterned) return f;
      const patterns: { pattern: PatternId; rot: number }[] = [
        { pattern: "arrow", rot: 1 },
        { pattern: "diagonal", rot: 0 },
        { pattern: "shang", rot: 1 },
        { pattern: "triangle", rot: 0 },
        { pattern: "tee", rot: 1 },
        { pattern: "dot", rot: 0 },
      ];
      return { ...f, ...patterns[i]! };
    });
    setNetId(id);
    setFaces(next);
    setSelected(null);
    setEdge(null);
    setVertexKey(null);
    setClockPick([]);
    setNote(netById(id).blurb);
    setQuiz(null);
    setLock(false);
    setPicked(null);
    setRevealed(false);
  }

  function openLesson(id: LessonId) {
    setLesson(id);
    if (id === "edge") setTool("edge");
    else if (id === "vertex") setTool("vertex");
    else if (id === "move") setTool("move");
    else if (id === "clock") setTool("clock");
    else setTool("none");
  }

  function reset() {
    load(netId);
    setStep(0);
    setPlaying(false);
    setInside(false);
  }

  function selectFace(id: FaceId) {
    setSelected(id);
    if (tool === "clock") {
      setClockPick((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((x) => x !== id) : [...prev, id].slice(-3);
        return next;
      });
    }
  }

  function moveFace(id: FaceId, x: number, y: number) {
    if (lock) {
      setNote("这道题的展开图已锁定。先作答，或退出练习再移块。");
      return;
    }
    const result = tryMoveFace(faces, id, x, y);
    if (result.ok) {
      setFaces(result.faces);
      setNote(result.reason + " " + describeShape(result.faces).title + "。相对面没有换人。");
    } else {
      setNote(result.reason);
    }
  }

  function paint(pattern: PatternId) {
    if (!selected || lock) return;
    setFaces((fs) => fs.map((f) => (f.id === selected ? { ...f, pattern } : f)));
  }

  function rotate(delta: number) {
    if (!selected || lock) return;
    setFaces((fs) => fs.map((f) => (f.id === selected ? { ...f, rot: (f.rot + delta + 4) % 4 } : f)));
  }

  function runDemo(which: 0 | 1) {
    const demo = DEMOS[which]!;
    let next = loadNet(demo.netId);
    const lines = [demo.title + "。"];
    for (const s of demo.steps) {
      const r = tryMoveFace(next, s.face, s.x, s.y);
      lines.push(s.say);
      lines.push(r.ok ? r.reason : r.reason);
      if (!r.ok) break;
      next = r.faces;
    }
    setNetId(demo.netId);
    setFaces(next);
    setTool("move");
    setLesson("move");
    setLock(false);
    setQuiz(null);
    setNote(lines.join(""));
  }

  function startQuiz(q: Quiz) {
    setQuiz(q);
    setFaces(q.faces);
    setLesson("drill");
    setLock(true);
    setPicked(null);
    setRevealed(false);
    setSelected(null);
    setNote(null);
    setStep(0);
  }

  function skipGuide() {
    try {
      localStorage.setItem("cube-guide-v1", "1");
    } catch {
      /* ignore */
    }
    setGuide(null);
  }

  const lines: string[] = [];
  if (note) lines.push(note);
  if (!fold.valid) lines.push(fold.reason);
  else lines.push(`${shape.title}。${shape.detail}`);
  if (selected) {
    const opp = oppositeOf(fold, selected);
    if (opp) lines.push(opp.text + "相对面在展开图上绝不会共边。");
    else if (!fold.valid) lines.push(`${selected} 所在的展开图不合法，先不要认相对面。`);
    const face = faces.find((f) => f.id === selected);
    if (face && face.pattern !== "blank" && face.pattern !== "cross") {
      const arrow = arrowPointsTo(fold, selected);
      if (arrow) lines.push(arrow.text);
    }
  }
  if (edge) lines.push(explainEdge(fold, edge));
  if (vGroup) lines.push(explainVertex(vGroup));
  if (clockGroup && (tool === "clock" || lesson === "clock")) {
    lines.push(explainClock(fold, clockGroup, !inside));
  } else if (tool === "clock" && clockPick.length === 3 && !clockGroup) {
    lines.push("这三个面没有交在同一个顶点。请改点一个已经标出的角。");
  }

  const judgment = lines.filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="flex min-h-dvh w-full max-w-full flex-col overflow-x-hidden bg-paper text-ink">
      <header className="min-w-0 border-b border-line bg-card">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <div className="mr-2">
            <p className="font-serif text-lg font-semibold leading-tight">正方体展开图</p>
            <p className="text-xs text-muted">行测图形推理 · 展开与折叠</p>
          </div>
          <label className="flex h-11 max-w-full min-w-0 items-center gap-2 rounded-xl border border-line bg-paper px-2 text-sm">
            <span className="shrink-0 text-muted">图型</span>
            <select
              className="h-9 min-w-0 max-w-48 bg-transparent pr-2"
              value={netId}
              onChange={(e) => load(e.target.value)}
            >
              <optgroup label="141 · 六种">
                {NETS.filter((n) => n.family === "141").map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="132 / 231 · 三种">
                {NETS.filter((n) => n.family === "132").map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="222 · 33">
                {NETS.filter((n) => n.family === "222" || n.family === "33").map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="非法，用来对照">
                {NETS.filter((n) => n.family === "bad").map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <Btn onClick={reset}>重置</Btn>
          <Btn on={playing && playDir > 0} onClick={() => { setPlayDir(1); setPlaying(true); if (step >= maxStep) setStep(0); }}>
            折叠
          </Btn>
          <Btn onClick={() => { setPlayDir(-1); setPlaying(true); }}>展开</Btn>
          <Btn on={playing} onClick={() => setPlaying(false)}>暂停</Btn>
          <Btn
            onClick={() => {
              setPlaying(false);
              setStep((s) => Math.min(maxStep, Math.floor(s + 0.001) + 1));
            }}
          >
            单步
          </Btn>
          <Btn
            onClick={() => {
              setPlaying(false);
              setStep((s) => Math.max(0, Math.ceil(s - 0.001) - 1));
            }}
          >
            倒放
          </Btn>
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 pb-2">
          <Btn on={tool === "move"} onClick={() => setTool(tool === "move" ? "none" : "move")}>移块</Btn>
          <Btn on={tool === "edge"} onClick={() => setTool(tool === "edge" ? "none" : "edge")}>画边</Btn>
          <Btn on={tool === "vertex"} onClick={() => setTool(tool === "vertex" ? "none" : "vertex")}>公共点</Btn>
          <Btn on={tool === "clock"} onClick={() => setTool(tool === "clock" ? "none" : "clock")}>时针</Btn>
          <Btn
            on={inside}
            onClick={() => {
              setInside((v) => !v);
              setStep(maxStep);
              setPlaying(false);
            }}
          >
            {inside ? "内部视角" : "外部视角"}
          </Btn>
        </div>
      </header>

      {guide !== null && (
        <div className="border-b border-line bg-primary-soft px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-primary">
              引导 {guide + 1}/4 · 约 {15 * (4 - guide)} 秒
            </p>
            <button type="button" className="text-sm text-primary underline" onClick={skipGuide}>
              跳过
            </button>
          </div>
          <p className="text-sm leading-relaxed">{GUIDE[guide]}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-card">
            <div className="h-full bg-primary" style={{ width: `${((guide + 1) / 4) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="grid min-w-0 flex-1 lg:grid-cols-12 lg:overflow-hidden">
        <nav className="flex min-w-0 gap-2 overflow-x-auto border-b border-line bg-card px-3 py-2 lg:col-span-2 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r">
          {LESSONS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => openLesson(l.id)}
              className={
                "h-11 shrink-0 rounded-xl px-3 text-left text-sm lg:w-full " +
                (lesson === l.id ? "bg-primary text-on-primary" : "bg-paper text-ink")
              }
            >
              {l.name}
            </button>
          ))}
        </nav>

        <section className="flex min-w-0 flex-col gap-3 p-3 lg:col-span-7 lg:min-h-0 lg:overflow-auto">
          {lesson === "drill" && (
            <Practice
              quiz={quiz}
              qIndex={qIndex}
              picked={picked}
              revealed={revealed}
              stepsOn={stepsOn}
              onPick={(i) => {
                setPicked(i);
                setRevealed(true);
              }}
              onStart={(i) => {
                setQIndex(i);
                startQuiz(QUIZZES[i]!);
              }}
              onCustom={() => {
                const made = quizFromFaces(faces);
                if ("error" in made) setNote(made.error);
                else startQuiz(made);
              }}
              onExit={() => {
                setQuiz(null);
                setLock(false);
                setRevealed(false);
                setPicked(null);
              }}
            />
          )}
          <div className={"grid gap-3 lg:grid-cols-2 " + (lesson === "drill" ? "lg:min-h-72" : "lg:min-h-96 lg:flex-1")}>
            <div className="flex min-h-80 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={"rounded-full px-2 py-1 text-xs " + (fold.valid ? "bg-ok-soft text-ok" : "bg-seal-soft text-seal")}>
                  {shape.title}
                </span>
                <span className="text-xs text-muted">字母从上到下、从左到右为 A–F。甲乙丙是三对相对面。</span>
              </div>
              <div className="min-h-72 flex-1">
                <NetBoard
                  faces={faces}
                  fold={fold}
                  selected={selected}
                  edge={edge}
                  partner={partner ? partner.ref : null}
                  vertexKey={vertexKey}
                  ghosts={ghosts.map((g) => ({ x: g.x, y: g.y }))}
                  showEdgeNo={tool === "edge"}
                  moveEnabled={tool === "move" && !lock}
                  onSelect={selectFace}
                  onEdge={(id, dir) => {
                    setEdge({ id, dir });
                    setTool("edge");
                  }}
                  onVertex={(key) => {
                    setVertexKey(key);
                    setTool((t) => (t === "clock" ? t : "vertex"));
                  }}
                  onMove={moveFace}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {PATTERN_LIST.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!selected || lock}
                    onClick={() => paint(p.id)}
                    className="h-11 shrink-0 rounded-xl border border-line bg-card px-3 text-sm disabled:opacity-40"
                  >
                    {p.name}
                  </button>
                ))}
                <Btn onClick={() => rotate(-1)}>左转</Btn>
                <Btn onClick={() => rotate(1)}>右转</Btn>
              </div>
            </div>
            <div className="relative min-h-80 overflow-hidden rounded-card border border-line bg-card">
              {!fold.valid && (
                <p className="absolute left-3 right-3 top-3 z-10 rounded-lg bg-seal-soft px-3 py-2 text-sm text-seal">
                  不合法，无法折成无重叠正方体。
                </p>
              )}
              {inside && (
                <p className="absolute bottom-3 left-3 right-3 z-10 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                  内部视角：图案左右颠倒，时针相反。做题要切回外部。
                </p>
              )}
              <CubeStage
                snap={{
                  faces,
                  fold,
                  step: Math.min(step, maxStep),
                  selected,
                  edge,
                  partner: partner ? partner.ref : null,
                  corners: (clockGroup ?? vGroup)?.corners ?? [],
                  inside,
                  onSelect: selectFace,
                }}
              />
            </div>
          </div>
        </section>

        <aside className="scroll-thin min-w-0 space-y-3 border-t border-line bg-card p-3 lg:col-span-3 lg:overflow-y-auto lg:border-l lg:border-t-0">
          <section>
            <h2 className="font-serif text-base font-semibold">当前判定</h2>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed">
              {judgment.map((line) => (
                <li key={line} className="rounded-lg bg-paper px-3 py-2">
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-base font-semibold">{lessonMeta.name}</h2>
            <p className="mt-2 text-sm leading-relaxed">{lessonMeta.def}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">
              {lessonMeta.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>

          {lesson === "nets" && (
            <section>
              <h3 className="text-sm font-medium">一键载入</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {NETS.map((n) => (
                  <NetThumb key={n.id} cells={n.cells} label={n.name} active={netId === n.id} onClick={() => load(n.id)} />
                ))}
              </div>
              <p className="mt-2 text-sm text-muted">{netById(netId).blurb}</p>
            </section>
          )}

          {lesson === "opposite" && (
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => load("141-22", true)}>正例 · 十字</Btn>
              <Btn onClick={() => load("222", true)}>正例 · Z 字</Btn>
              <Btn onClick={() => load("bad-tian")}>反例 · 田字</Btn>
            </div>
          )}
          {lesson === "edge" && (
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => { load("141-23", true); setTool("edge"); }}>正例 · 追一条边</Btn>
              <Btn onClick={() => load("bad-corner")}>反例 · 对角不算边</Btn>
            </div>
          )}
          {lesson === "vertex" && (
            <Btn onClick={() => { load("141-22", true); setTool("vertex"); }}>正例 · 点一个角</Btn>
          )}
          {lesson === "move" && (
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => runDemo(0)}>演示 141 移成 132</Btn>
              <Btn onClick={() => runDemo(1)}>演示阶梯滚出隔一面</Btn>
            </div>
          )}
          {lesson === "clock" && (
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => { load("33", true); setTool("clock"); }}>正例 · 33 的朝向</Btn>
              <Btn
                on={inside}
                onClick={() => {
                  setInside((v) => !v);
                  setStep(maxStep);
                }}
              >
                切换内外
              </Btn>
            </div>
          )}
          {(lesson === "flow" || lesson === "drill") && (
            <section>
              <h3 className="text-sm font-medium">排除步骤</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(STEP_LABEL) as (keyof typeof STEP_LABEL)[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setStepsOn((s) => ({ ...s, [k]: !s[k] }))}
                    className={
                      "h-11 rounded-xl px-3 text-sm " +
                      (stepsOn[k] ? "bg-primary text-on-primary" : "border border-line bg-paper text-muted")
                    }
                  >
                    {STEP_LABEL[k]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-muted">关掉某一步，核对答案时就先不看那条理由。</p>
            </section>
          )}
        </aside>
      </div>

      <footer className="border-t border-line bg-card px-4 py-3">
        <p className="font-serif text-sm leading-relaxed">
          <span className="text-muted">本题可用方法 · </span>
          {quiz && revealed ? quiz.method : lessonMeta.mnemonic}
        </p>
      </footer>
    </div>
  );
}

function Btn({
  children,
  onClick,
  on,
}: {
  children: ReactNode;
  onClick?: () => void;
  on?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "h-11 shrink-0 rounded-xl px-3 text-sm font-medium " +
        (on ? "bg-primary text-on-primary" : "border border-line bg-card text-ink")
      }
    >
      {children}
    </button>
  );
}

function Practice({
  quiz,
  qIndex,
  picked,
  revealed,
  stepsOn,
  onPick,
  onStart,
  onCustom,
  onExit,
}: {
  quiz: Quiz | null;
  qIndex: number;
  picked: number | null;
  revealed: boolean;
  stepsOn: { opposite: boolean; edge: boolean; vertex: boolean; clock: boolean };
  onPick: (i: number) => void;
  onStart: (i: number) => void;
  onCustom: () => void;
  onExit: () => void;
}) {
  return (
    <div className="rounded-card border border-line bg-card p-3">
      {!quiz && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-base font-semibold">练习</h2>
            <Btn onClick={onCustom}>用当前图案出题</Btn>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {QUIZZES.map((q, i) => (
              <button
                key={q.id}
                type="button"
                data-quiz={q.id}
                onClick={() => onStart(i)}
                className="h-auto rounded-xl border border-line bg-paper px-3 py-3 text-left text-sm"
              >
                <span className="text-muted">{i + 1}. </span>
                {q.title}
              </button>
            ))}
          </div>
        </>
      )}
      {quiz && (
        <>
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-serif text-base font-semibold">
                {quiz.id === "custom" ? quiz.title : `${qIndex + 1}. ${quiz.title}`}
              </h2>
              <p className="mt-1 text-sm leading-relaxed">{quiz.stem}</p>
            </div>
            <Btn onClick={onExit}>退出练习</Btn>
          </div>
          {quiz.shape === "cube" ? (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {quiz.options.map((opt, i) => {
                const show = revealed && (opt.correct || stepsOn[opt.step] || picked === i);
                const mark = revealed && (opt.correct ? "border-ok bg-ok-soft" : picked === i ? "border-seal bg-seal-soft" : "border-line");
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={revealed}
                    onClick={() => onPick(i)}
                    className={"rounded-xl border-2 bg-paper p-2 text-left " + (revealed ? mark : "border-line")}
                  >
                    <span className="mb-1 block text-sm font-medium">{["A", "B", "C", "D"][i]}</span>
                    <MiniCube faces={opt.faces} view={opt.view} mirror={opt.mirror} />
                    {show && (
                      <p className={"mt-1 text-xs leading-relaxed " + (opt.correct ? "text-ok" : "text-seal")}>
                        {opt.correct ? "正确。 " : `排除（${STEP_LABEL[opt.step]}）。 `}
                        {opt.reason}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {quiz.nets.map((n, i) => {
                const def = netById(n.netId);
                return (
                  <button
                    key={n.netId}
                    type="button"
                    disabled={revealed}
                    onClick={() => onPick(i)}
                    className={
                      "rounded-xl border-2 bg-paper p-3 text-left " +
                      (revealed ? (n.correct ? "border-ok bg-ok-soft" : picked === i ? "border-seal bg-seal-soft" : "border-line") : "border-line")
                    }
                  >
                    <NetThumb cells={def.cells} label={def.name} passive />
                    <p className="mt-2 text-sm">{def.name}</p>
                    {revealed && (n.correct || picked === i) && (
                      <p className={"mt-1 text-xs leading-relaxed " + (n.correct ? "text-ok" : "text-seal")}>{n.reason}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {revealed && (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
              {quiz.review.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
