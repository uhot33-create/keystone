import type { SmokingState } from "./types";

const STAGES = [
  { src: "/smoking/saburo/01-resigned.jpg", label: "仕方ない" },
  { src: "/smoking/saburo/02-annoyed.jpg", label: "ちょっと不満" },
  { src: "/smoking/saburo/03-angry.jpg", label: "怒り" },
  { src: "/smoking/saburo/04-very-angry.jpg", label: "かなり怒り" },
  { src: "/smoking/saburo/05-furious.jpg", label: "激おこ" },
] as const;

export function saburoStage(state: SmokingState) {
  if (state.exceeded) return STAGES[4];
  const ratio = state.dailyLimit > 0 ? state.remaining / state.dailyLimit : 0;
  if (ratio >= 0.75) return STAGES[0];
  if (ratio >= 0.5) return STAGES[1];
  if (ratio >= 0.25) return STAGES[2];
  return STAGES[3];
}
