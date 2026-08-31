import type { JSX } from "react";
import { useTheme } from "@/components/theme-provider";
import type { ThemeId } from "@/lib/theme";

export function ThemeMotif() {
  const { theme } = useTheme();
  if (theme === "default") return null;
  const Motif = MOTIFS[theme];
  if (!Motif) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <svg
        viewBox="0 0 420 420"
        className="absolute -right-10 -bottom-16 h-[min(92vh,40rem)] w-[min(92vw,40rem)] opacity-[0.26] sm:-right-6 sm:-bottom-10"
      >
        <Motif />
      </svg>
    </div>
  );
}

const MOTIFS: Partial<Record<ThemeId, () => JSX.Element>> = {
  spring: SpringMotif,
  summer: SummerMotif,
  autumn: AutumnMotif,
  winter: WinterMotif,
};

/** 桜 + いちご */
function SpringMotif() {
  return (
    <g fill="none">
      <Sakura cx={250} cy={168} r={118} petal="#e8a0b4" center="#f4dce4" />
      <Strawberry x={86} y={214} />
    </g>
  );
}

/** ひまわり + すいか */
function SummerMotif() {
  return (
    <g fill="none">
      <Sunflower cx={268} cy={132} />
      <Watermelon x={40} y={168} />
    </g>
  );
}

/** 菊 + 柿 */
function AutumnMotif() {
  return (
    <g fill="none">
      <Chrysanthemum cx={268} cy={150} />
      <Persimmon x={70} y={188} />
    </g>
  );
}

/** 椿 + ゆず */
function WinterMotif() {
  return (
    <g fill="none">
      <Camellia cx={262} cy={148} />
      <Yuzu x={58} y={200} />
    </g>
  );
}

function Sakura({ cx, cy, r, petal, center }: { cx: number; cy: number; r: number; petal: string; center: string }) {
  const petals = [0, 72, 144, 216, 288].map((deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    const x = cx + Math.cos(rad) * r * 0.18;
    const y = cy + Math.sin(rad) * r * 0.18;
    return (
      <ellipse
        key={deg}
        cx={x}
        cy={y}
        rx={r * 0.34}
        ry={r * 0.52}
        fill={petal}
        transform={`rotate(${deg} ${x} ${y})`}
      />
    );
  });
  return (
    <g>
      {petals}
      <circle cx={cx} cy={cy} r={r * 0.16} fill={center} />
      <circle cx={cx} cy={cy} r={r * 0.07} fill="#c45c78" />
    </g>
  );
}

function Strawberry({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M64 18c22 4 44 28 44 58 0 38-22 70-44 86C42 146 20 114 20 76 20 46 42 22 64 18Z" fill="#d45a6a" />
      <path d="M64 18c-14 8-28 6-40 2 8 14 24 18 40 16 16 2 32-2 40-16-12 4-26 6-40-2Z" fill="#6a9a5c" />
      <circle cx="48" cy="62" r="3.2" fill="#f3e6c8" />
      <circle cx="76" cy="58" r="3.2" fill="#f3e6c8" />
      <circle cx="58" cy="86" r="3.2" fill="#f3e6c8" />
      <circle cx="82" cy="90" r="3.2" fill="#f3e6c8" />
      <circle cx="50" cy="110" r="3.2" fill="#f3e6c8" />
      <circle cx="72" cy="118" r="3.2" fill="#f3e6c8" />
    </g>
  );
}

function Sunflower({ cx, cy }: { cx: number; cy: number }) {
  const petals = Array.from({ length: 16 }, (_, i) => {
    const deg = i * 22.5;
    const rad = ((deg - 90) * Math.PI) / 180;
    const x = cx + Math.cos(rad) * 28;
    const y = cy + Math.sin(rad) * 28;
    return (
      <ellipse
        key={deg}
        cx={x}
        cy={y}
        rx={18}
        ry={42}
        fill="#e0b43a"
        transform={`rotate(${deg} ${x} ${y})`}
      />
    );
  });
  return (
    <g>
      {petals}
      <circle cx={cx} cy={cy} r={36} fill="#6b4a28" />
      <circle cx={cx} cy={cy} r={22} fill="#4a341c" />
    </g>
  );
}

function Watermelon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M20 40c8 88 72 156 168 168L188 28C112 20 36-8 20 40Z" fill="#3d8b6e" />
      <path d="M36 48c10 72 62 132 148 144L176 42C112 36 52 16 36 48Z" fill="#f4dce0" />
      <path d="M48 56c10 62 54 114 132 126L168 52C112 48 64 28 48 56Z" fill="#e07a7a" />
      <ellipse cx="88" cy="96" rx="5" ry="8" fill="#2a3a32" transform="rotate(-28 88 96)" />
      <ellipse cx="124" cy="78" rx="5" ry="8" fill="#2a3a32" transform="rotate(-18 124 78)" />
      <ellipse cx="108" cy="128" rx="5" ry="8" fill="#2a3a32" transform="rotate(-24 108 128)" />
      <ellipse cx="146" cy="118" rx="5" ry="8" fill="#2a3a32" transform="rotate(-12 146 118)" />
    </g>
  );
}

function Chrysanthemum({ cx, cy }: { cx: number; cy: number }) {
  const petals = Array.from({ length: 20 }, (_, i) => {
    const deg = i * 18;
    const rad = ((deg - 90) * Math.PI) / 180;
    const x = cx + Math.cos(rad) * 22;
    const y = cy + Math.sin(rad) * 22;
    return (
      <ellipse
        key={deg}
        cx={x}
        cy={y}
        rx={14}
        ry={48}
        fill="#e0a060"
        transform={`rotate(${deg} ${x} ${y})`}
      />
    );
  });
  return (
    <g>
      {petals}
      <circle cx={cx} cy={cy} r={22} fill="#c4782a" />
    </g>
  );
}

function Persimmon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="88" cy="96" rx="78" ry="72" fill="#d06030" />
      <ellipse cx="88" cy="90" rx="70" ry="62" fill="#e07038" />
      <path d="M88 24c-18 8-32 6-48 2 10 16 28 24 48 22 20 2 38-6 48-22-16 4-30 6-48-2Z" fill="#4a7a3a" />
      <rect x="82" y="8" width="12" height="22" rx="4" fill="#5a4a28" />
    </g>
  );
}

function Camellia({ cx, cy }: { cx: number; cy: number }) {
  const petals = [0, 60, 120, 180, 240, 300].map((deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    const x = cx + Math.cos(rad) * 26;
    const y = cy + Math.sin(rad) * 26;
    return (
      <ellipse
        key={deg}
        cx={x}
        cy={y}
        rx={36}
        ry={52}
        fill="#c45c6a"
        transform={`rotate(${deg} ${x} ${y})`}
      />
    );
  });
  return (
    <g>
      {petals}
      <circle cx={cx} cy={cy} r={28} fill="#f0d48a" />
      <circle cx={cx} cy={cy} r={12} fill="#c4782a" />
    </g>
  );
}

function Yuzu({ x, y }: { x: number; y: number }) {
  const dots = [
    [70, 70],
    [110, 64],
    [88, 96],
    [54, 108],
    [120, 102],
    [76, 128],
    [108, 132],
    [64, 88],
    [98, 80],
  ];
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="88" cy="100" r="78" fill="#e0c24a" />
      <circle cx="88" cy="96" r="70" fill="#edd05a" />
      {dots.map(([dx, dy]) => (
        <circle key={`${dx}-${dy}`} cx={dx} cy={dy} r="3.5" fill="#c4a838" />
      ))}
      <ellipse cx="88" cy="36" rx="10" ry="8" fill="#6a9a5c" />
    </g>
  );
}
