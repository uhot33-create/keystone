const STAGES = [
  { src: "/calorie/saburo/01-standard.jpg", label: "今の体型" },
  { src: "/calorie/saburo/02-round.jpg", label: "すこし丸い" },
  { src: "/calorie/saburo/03-chubby.jpg", label: "ぽっちゃり" },
  { src: "/calorie/saburo/04-fat.jpg", label: "ふとってきた" },
  { src: "/calorie/saburo/05-stuffed.jpg", label: "かなり太い" },
] as const;

export function calorieSaburoStage(total: number, target: number) {
  if (target <= 0) return STAGES[0];
  const ratio = total / target;
  if (ratio < 0.5) return STAGES[0];
  if (ratio < 0.85) return STAGES[1];
  if (ratio < 1.1) return STAGES[2];
  if (ratio < 1.3) return STAGES[3];
  return STAGES[4];
}
