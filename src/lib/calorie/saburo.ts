/**
 * 今日画面の左に出す「さぶろう」の体型画像です。TodayPanel が
 * calorieSaburoStage(今日の合計, 1日の目標) の戻りを img に使います。
 * 触りやすいところ: STAGES の画像パスと label（今の体型／すこし丸い／かなり太い／もっと太い）。
 * 切り替えは「残り5kcal未満」で1段丸く、「超過が0より大きい」でかなり太い、
 * 「超過10kcal以上」でもっと太い、です。数字を変えると表情が変わるラインが動きます。
 * 画像ファイル自体は public の /calorie/saburo/ にあります。
 */
import { truncKcal } from "@/lib/calorie/formula";

/**
 * 4段階の画像と文言です。0が標準、1が残りわずか、2が少し超過、3が10kcal以上の超過。
 * src や label を変えると今日画面の見た目だけ変わります。順番を入れ替えると段階の意味がずれます。
 */
const STAGES = [
  { src: "/calorie/saburo/01-standard.jpg", label: "今の体型" },
  { src: "/calorie/saburo/12-near.jpg", label: "すこし丸い" },
  { src: "/calorie/saburo/15-quite.jpg", label: "かなり太い" },
  { src: "/calorie/saburo/16-heavier.jpg", label: "もっと太い" },
] as const;

/**
 * 今日の合計と目標から、さぶろうの段階を選びます。目標が0以下なら標準（STAGES[0]）。
 * 超過10以上で「もっと太い」、超過が0より大きければ「かなり太い」。
 * 残りが5kcal未満（ぴったりも含む）なら「すこし丸い」。それより残っていれば「今の体型」です。
 */
export function calorieSaburoStage(total: number, target: number) {
  if (target <= 0) return STAGES[0];
  const over = truncKcal(total - target);
  if (over >= 10) return STAGES[3];
  if (over > 0) return STAGES[2];
  if (truncKcal(target - total) < 5) return STAGES[1];
  return STAGES[0];
}