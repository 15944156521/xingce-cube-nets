import { localPattern, type PatternId } from "@/cube/geometry";
import { patternFigs } from "@/cube/patterns";

/** 把图案画进以格子中心为原点的 SVG。+y 在屏幕上方，rot 为顺时针。 */
export function PatternSvg({ pattern, rot, s }: { pattern: PatternId; rot: number; s: number }) {
  const figs = patternFigs(pattern);
  const pt = (x: number, y: number) => {
    const { lu, lv } = localPattern(x, y, rot);
    return `${lu * s},${-lv * s}`;
  };
  return (
    <g className="text-ink">
      {figs.map((fig, i) => {
        if (fig.k === "line") {
          return (
            <polyline
              key={i}
              points={fig.pts.map(([x, y]) => pt(x, y)).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        if (fig.k === "fill") {
          return <polygon key={i} points={fig.pts.map(([x, y]) => pt(x, y)).join(" ")} fill="currentColor" />;
        }
        if (fig.k === "dot") {
          const { lu, lv } = localPattern(fig.x, fig.y, rot);
          return <circle key={i} cx={lu * s} cy={-lv * s} r={fig.r * s} fill="currentColor" />;
        }
        return (
          <text
            key={i}
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fig.size * s * 0.92}
            fontFamily="var(--font-serif), serif"
            fontWeight={700}
            fill="currentColor"
            transform={`rotate(${rot * 90})`}
          >
            {fig.text}
          </text>
        );
      })}
    </g>
  );
}
