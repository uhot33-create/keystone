import type { JSX, ReactNode } from "react";
import { useTheme } from "@/components/theme-provider";
import type { ThemeId } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function PaperWash({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("paper-wash relative isolate overflow-hidden", className)}>{children}</div>;
}

export function ThemeMotif({ compact = false }: { compact?: boolean }) {
  const { theme } = useTheme();
  if (theme === "default") return null;
  const Motif = MOTIFS[theme];
  if (!Motif) return null;
  if (compact) {
    return (
      <span className="grid h-11 w-14 shrink-0 place-items-center overflow-hidden" aria-hidden="true">
        <svg viewBox="0 0 420 420" className="h-11 w-14">
          <Motif />
        </svg>
      </span>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 420 420" className="absolute -right-8 bottom-[-6%] h-[min(85vh,36rem)] w-[min(90vw,36rem)]">
        <Motif />
      </svg>
    </div>
  );
}

const MOTIFS: Partial<Record<ThemeId, () => JSX.Element>> = {
  spring: SpringMotif,
  midori: MidoriMotif,
  tsuyu: TsuyuMotif,
  summer: SummerMotif,
  autumn: AutumnMotif,
  tsukimi: TsukimiMotif,
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

/** 若葉 + 青梅 */
function MidoriMotif() {
  return (
    <g fill="none">
      <YoungLeaves cx={250} cy={150} />
      <Aoume x={58} y={188} />
    </g>
  );
}

/** 紫陽花 + 梅 */
function TsuyuMotif() {
  return (
    <g fill="none">
      <Hydrangea cx={262} cy={148} />
      <Ume x={54} y={196} />
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

/** ススキ + 団子 */
function TsukimiMotif() {
  return (
    <g fill="none">
      <Moon cx={268} cy={128} />
      <Susuki x={40} y={40} />
      <Dango x={70} y={210} />
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

function YoungLeaves({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <ellipse cx={cx - 36} cy={cy + 8} rx={42} ry={70} fill="#7a9a4a" transform={`rotate(-28 ${cx - 36} ${cy + 8})`} />
      <ellipse cx={cx + 28} cy={cy - 6} rx={38} ry={64} fill="#4a7a48" transform={`rotate(22 ${cx + 28} ${cy - 6})`} />
      <ellipse cx={cx + 4} cy={cy + 24} rx={32} ry={52} fill="#8aaa58" transform={`rotate(-6 ${cx + 4} ${cy + 24})`} />
      <path d={`M${cx} ${cy + 70} C${cx - 8} ${cy + 20} ${cx - 18} ${cy - 40} ${cx - 28} ${cy - 70}`} stroke="#3a5a38" strokeWidth="6" fill="none" />
    </g>
  );
}

function Aoume({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="88" cy="100" rx="70" ry="64" fill="#6a9a58" />
      <ellipse cx="88" cy="94" rx="62" ry="56" fill="#7aaa68" />
      <ellipse cx="70" cy="82" rx="18" ry="12" fill="#c8dcb0" opacity="0.55" />
      <ellipse cx="88" cy="40" rx="10" ry="8" fill="#4a7a48" />
      <rect x="83" y="18" width="10" height="22" rx="3" fill="#5a4a28" />
    </g>
  );
}

function Hydrangea({ cx, cy }: { cx: number; cy: number }) {
  const florets = [
    [0, -38, "#7a8ab8"],
    [34, -18, "#5a6a9a"],
    [34, 18, "#8aa0c8"],
    [0, 38, "#5a6a9a"],
    [-34, 18, "#7a8ab8"],
    [-34, -18, "#9ab0d0"],
    [0, 0, "#c8b0d0"],
  ] as const;
  return (
    <g>
      {florets.map(([dx, dy, fill]) => (
        <g key={`${dx}-${dy}`}>
          {[0, 90, 180, 270].map((deg) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            const px = cx + dx + Math.cos(rad) * 14;
            const py = cy + dy + Math.sin(rad) * 14;
            return <ellipse key={deg} cx={px} cy={py} rx={16} ry={22} fill={fill} transform={`rotate(${deg} ${px} ${py})`} />;
          })}
          <circle cx={cx + dx} cy={cy + dy} r={7} fill="#f4efe8" />
        </g>
      ))}
    </g>
  );
}

function Ume({ x, y }: { x: number; y: number }) {
  const cx = 88;
  const cy = 96;
  const petals = [0, 72, 144, 216, 288].map((deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    const px = cx + Math.cos(rad) * 16;
    const py = cy + Math.sin(rad) * 16;
    return <ellipse key={deg} cx={px} cy={py} rx={28} ry={36} fill="#d48aa0" transform={`rotate(${deg} ${px} ${py})`} />;
  });
  return (
    <g transform={`translate(${x} ${y})`}>
      {petals}
      <circle cx={cx} cy={cy} r={16} fill="#f4e6c8" />
      <circle cx={cx} cy={cy} r={7} fill="#c45c78" />
    </g>
  );
}

function Moon({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={86} fill="#e8d090" />
      <circle cx={cx} cy={cy} r={78} fill="#f2e2a8" />
      <circle cx={cx - 18} cy={cy - 8} r={14} fill="#e0c878" opacity="0.55" />
      <circle cx={cx + 22} cy={cy + 18} r={10} fill="#e0c878" opacity="0.45" />
    </g>
  );
}

function Susuki({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="none" stroke="#8a6a3a" strokeWidth="5" strokeLinecap="round">
      <path d="M40 280 C48 180 40 90 70 20" />
      <path d="M88 280 C80 170 110 80 150 8" />
      <path d="M130 280 C140 190 128 100 176 36" />
      <ellipse cx="78" cy="36" rx="18" ry="40" fill="#c4a050" stroke="none" transform="rotate(-18 78 36)" />
      <ellipse cx="156" cy="24" rx="16" ry="36" fill="#d4b468" stroke="none" transform="rotate(12 156 24)" />
      <ellipse cx="182" cy="52" rx="14" ry="32" fill="#c4a050" stroke="none" transform="rotate(22 182 52)" />
    </g>
  );
}

function Dango({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="84" y="8" width="8" height="150" rx="4" fill="#5a4a28" />
      <circle cx="88" cy="40" r="26" fill="#e8d0d0" />
      <circle cx="88" cy="90" r="26" fill="#f4efe0" />
      <circle cx="88" cy="140" r="26" fill="#d8c07a" />
    </g>
  );
}

