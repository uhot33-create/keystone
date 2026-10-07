import { truncKcal } from "@/lib/calorie/formula";

const STAGES = [
  { src: "/calorie/saburo/01-standard.jpg", label: "今の体型" },
  { src: "/calorie/saburo/12-near.jpg", label: "すこし丸い" },
  { src: "/calorie/saburo/15-quite.jpg", label: "かなり太い" },
  { src: "/calorie/saburo/16-heavier.jpg", label: "もっと太い" },
] as const;

export function calorieSaburoStage(total: number, target: number) {
  if (target <= 0) return STAGES[0];
  const over = truncKcal(total - target);
  if (over >= 10) return STAGES[3];
  if (over > 0) return STAGES[2];
  if (truncKcal(target - total) < 5) return STAGES[1];
  return STAGES[0];
}