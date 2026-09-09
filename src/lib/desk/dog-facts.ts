import { getSql } from "@/lib/db";
import type { DailyStory } from "./types";

const UA = "KurashiCho/1.0 (https://github.com/uhot33-create/keystone)";

type WikiSource = { key: string; kind: "wiki"; page: string };
type LocalSource = {
  key: string;
  kind: "local";
  title: string;
  text: string;
  source: string;
  sourceUrl: string;
};
type DogSource = WikiSource | LocalSource;

function wikiCite(page: string) {
  return {
    source: `Wikipedia「${page}」`,
    sourceUrl: `https://ja.wikipedia.org/wiki/${encodeURIComponent(page)}`,
  };
}

const WIKI_PAGES = [
  "犬",
  "柴犬",
  "秋田犬",
  "北海道犬",
  "甲斐犬",
  "紀州犬",
  "四国犬",
  "土佐犬",
  "狆",
  "日本犬",
  "忠犬ハチ公",
  "イエイヌ",
  "オオカミ",
  "ディンゴ",
  "犬ぞり",
  "盲導犬",
  "聴導犬",
  "介助犬",
  "警察犬",
  "災害救助犬",
  "探知犬",
  "番犬",
  "セラピー犬",
  "ドッグフード",
  "マイクロチップ (動物)",
  "狂犬病",
  "フィラリア",
  "熱中症",
  "しつけ",
  "リード (動物)",
  "ハーネス",
  "首輪",
  "犬笛",
  "ドッグラン",
  "ドッグショー",
  "アジリティ",
  "社会化 (動物)",
  "換毛",
  "パンティング",
  "色覚",
  "聴覚",
  "嗅覚",
  "肉球",
  "犬歯",
  "家畜化",
  "去勢",
  "避妊手術",
  "保護犬",
  "動物愛護",
  "チョコレート中毒",
  "キシリトール",
  "タマネギ中毒",
  "ボーダー・コリー",
  "ラブラドール・レトリーバー",
  "ゴールデン・レトリーバー",
  "トイプードル",
  "チワワ",
  "フレンチ・ブルドッグ",
  "パグ",
  "ビーグル",
  "コーギー",
  "ミニチュア・ダックスフント",
  "ポメラニアン",
  "シベリアン・ハスキー",
  "サモエド",
  "ジャーマン・シェパード・ドッグ",
  "ドーベルマン",
  "グレート・デーン",
  "マルチーズ",
  "ヨークシャー・テリア",
  "シーズー",
  "パピヨン",
  "ペキニーズ",
  "ボストン・テリア",
  "キャバリア・キング・チャールズ・スパニエル",
  "アイリッシュ・セター",
  "ダルメシアン",
  "シェルティ",
  "バーニーズ・マウンテン・ドッグ",
  "セント・バーナード",
  "ブルドッグ",
  "グレイハウンド",
  "ウィペット",
];

const LOCAL_FACTS: LocalSource[] = [
  { key: "local:nose-news", kind: "local", title: "匂いの新聞", text: "散歩で地面を嗅ぐのは、その場所を通った犬や人の情報を読むようなものです。急かさず嗅がせてあげると満足しやすいです。", ...wikiCite("嗅覚") },
  { key: "local:paws-sweat", kind: "local", title: "肉球と汗", text: "犬がよく汗をかく場所のひとつが肉球です。暑い日は地面の熱も伝わるので、散歩の時間帯をずらすのが有効です。", ...wikiCite("肉球") },
  { key: "local:tail-signal", kind: "local", title: "しっぽの合図", text: "しっぽを振る＝うれしい、とは限りません。高さや振りの速さ、体全体の緊張で、安心・興奮・警戒の違いが出ます。", ...wikiCite("尾") },
  { key: "local:yawn", kind: "local", title: "あくび", text: "あくびは眠いときだけでなく、緊張をほぐすときにも出ます。病院やトリミングの待ち時間によく見られます。", ...wikiCite("あくび") },
  { key: "local:zoomies", kind: "local", title: "突然のダッシュ", text: "部屋をぐるぐる走るのは、はしゃぎやストレス発散のことがあります。安全な場所なら、しばらく見守って大丈夫なことが多いです。", ...wikiCite("遊び") },
  { key: "local:left-right", kind: "local", title: "右と左の匂い", text: "犬は左右の鼻で匂いの方向をつかむのが上手です。風上に鼻を向ける仕草は、音だけでなく匂いでも世界を見ています。", ...wikiCite("嗅覚") },
  { key: "local:color", kind: "local", title: "色の見え方", text: "犬は青と黄は比較的わかりやすく、赤と緑は区別しにくいとされます。赤いおもちゃより、青や黄のほうが目立ちやすいことがあります。", ...wikiCite("色覚") },
  { key: "local:hearing", kind: "local", title: "高い音", text: "犬は人より高い音がよく聞こえます。遠いサイレンや電子音に反応するのは、その帯域に耳が強いからです。", ...wikiCite("聴覚") },
  { key: "local:age", kind: "local", title: "歳のとり方", text: "小型犬は比較的長寿、大型犬は早く歳をとる傾向があります。「人の7倍」は目安で、サイズや健康状態でかなり違います。", ...wikiCite("イヌ") },
  { key: "local:sleep", kind: "local", title: "睡眠時間", text: "成犬は1日の半分近く眠ることも珍しくありません。子犬やシニアはさらに長く、途中で起きるのも普通です。", ...wikiCite("睡眠") },
  { key: "local:pack", kind: "local", title: "人の家族", text: "犬は社会的ですが、家庭ではボス争いより、安心できる関係とルールのほうが大切です。", ...wikiCite("家畜化") },
  { key: "local:walk-sniff", kind: "local", title: "距離より匂い", text: "運動不足の解消は走る距離だけではありません。匂いを嗅ぐ散歩は頭の運動にもなります。", ...wikiCite("嗅覚") },
  { key: "local:water", kind: "local", title: "水の飲みすぎ", text: "遊んだあとに一気飲みすると、まれに水中毒のリスクがあります。休憩をはさみ、少しずつ飲ませるのが安心です。", ...wikiCite("水中毒") },
  { key: "local:onion", kind: "local", title: "ネギ類", text: "玉ねぎ・ねぎ・にんにくは犬には有害です。炒め油やスープの残りにも注意が必要です。", ...wikiCite("タマネギ中毒") },
  { key: "local:choco", kind: "local", title: "チョコレート", text: "カカオに含まれるテオブロミンは犬が分解しにくい成分です。高カカオほど危険度が上がります。", ...wikiCite("テオブロミン") },
  { key: "local:grape", kind: "local", title: "ぶどう", text: "ぶどうやレーズンは、少量でも体調を崩す例が報告されています。おやつには向きません。", source: "ASPCA People Foods", sourceUrl: "https://www.aspca.org/pet-care/animal-poison-control/people-foods-poisonous-pets" },
  { key: "local:xylitol", kind: "local", title: "キシリトール", text: "ガムや一部のスイーツに入る甘味料は、犬では血糖や肝臓に影響することがあります。", source: "FDA（キシリトールと犬）", sourceUrl: "https://www.fda.gov/consumers/consumer-updates/paws-xylitol-its-dangerous-dogs" },
  { key: "local:teeth", kind: "local", title: "歯のケア", text: "歯石は口のにおいだけでなく、全身の負担にもつながります。毎日でなくても、歯磨きの習慣は効果があります。", ...wikiCite("歯周病") },
  { key: "local:nails", kind: "local", title: "爪", text: "爪が伸びすぎると歩き方が変わり、肉球や関節に負担がかかります。カチカチ音がしたら、切る目安です。", ...wikiCite("爪") },
  { key: "local:coat", kind: "local", title: "換毛期", text: "春と秋に抜け毛が増える犬種が多いです。ブラッシングは見た目だけでなく、皮膚の風通しにもなります。", ...wikiCite("換毛") },
  { key: "local:cooling", kind: "local", title: "クールダウン", text: "犬は口呼吸で熱を逃がします。暑い日は日陰・水・短い散歩が、熱中症予防の基本です。", ...wikiCite("熱中症") },
  { key: "local:night-eye", kind: "local", title: "夜の目", text: "暗いところで目が光って見えるのは、光を再利用する層があるためです。完全な暗闇でも人より動きを捉えやすいです。", ...wikiCite("タペータム") },
  { key: "local:whisker", kind: "local", title: "ひげ", text: "口のまわりのひげは、狭い場所や風を感じるセンサーです。切ってしまうと、一時的に空間把握が雑になることがあります。", ...wikiCite("洞毛") },
  { key: "local:third-eyelid", kind: "local", title: "第三眼瞼", text: "目頭のピンクの膜は、目を守るためのものです。いつも大きく出ているときは、体調や目のチェックが必要です。", ...wikiCite("瞬膜") },
  { key: "local:ear", kind: "local", title: "垂れ耳と立ち耳", text: "垂れ耳は通気が少なく、汚れが残りやすいことがあります。耳のにおいと汚れは、定期的に見る価値があります。", ...wikiCite("イヌ") },
  { key: "local:recall", kind: "local", title: "呼ばれたら戻る", text: "名前を呼んで戻ってきたら、必ずほめる。呼び戻しは「呼ぶと嫌なことが起きる」になると、すぐに壊れます。", ...wikiCite("しつけ") },
  { key: "local:crate", kind: "local", title: "ハウス", text: "ケージは閉じ込め罰ではなく、休める部屋にすると落ち着きやすくなります。無理に入れず、おやつで良い印象を。", ...wikiCite("しつけ") },
  { key: "local:alone", kind: "local", title: "お留守番", text: "突然の長時間より、短い時間から慣らすほうが分離不安を防ぎやすいです。出入口だけの大げさな挨拶も興奮を増やします。", ...wikiCite("分離不安障害") },
  { key: "local:puppy-social", kind: "local", title: "子犬の世界", text: "生後数か月は人・音・床・他の犬に慣れる大事な時期です。こわがらせない範囲の経験が、あとまで残ります。", ...wikiCite("社会化 (動物)") },
  { key: "local:senior", kind: "local", title: "シニアの変化", text: "歩く速さ、夜鳴き、目や耳の衰えは年齢のサインです。散歩を短く小分けにすると、負担を減らせます。", ...wikiCite("老化") },
  { key: "local:rain", kind: "local", title: "雨の日", text: "濡れた肉球や耳の中は、放置するとにおいの原因になります。帰宅後のタオルだけでもかなり違います。", ...wikiCite("肉球") },
  { key: "local:snow", kind: "local", title: "雪道", text: "融雪剤は肉球を荒れさせます。短い散歩と、帰宅後の足洗いが安全です。", ...wikiCite("融雪剤") },
  { key: "local:car", kind: "local", title: "車内", text: "エンジンを止めた車内は短時間でも危険な暑さになります。犬だけ車に残すのは避けましょう。", source: "AVMA Pets and Hot Cars", sourceUrl: "https://www.avma.org/resources-tools/pet-owners/petcare/pets-and-hot-cars" },
  { key: "local:name", kind: "local", title: "名前の音", text: "短い音の名前は呼びやすいです。「ダメ」に似た音だと、叱りと名前が混ざることがあります。", ...wikiCite("しつけ") },
  { key: "local:play-bow", kind: "local", title: "プレイバウ", text: "前足を伸ばして尻を上げるのは「遊ぼう」のサインです。相手の犬が同じ返しをすれば、遊びが成立しやすいです。", ...wikiCite("遊び") },
  { key: "local:lick", kind: "local", title: "なめる", text: "なめるのは愛情だけでなく、味見・安心・要求のこともあります。頻度が極端なら、皮膚や口のチェックも。", ...wikiCite("イヌ") },
  { key: "local:circle", kind: "local", title: "寝る前の円", text: "寝る前にくるっと回るのは、地面を整える名残とも、落ち着きの動作とも言われます。", ...wikiCite("イヌ") },
  { key: "local:hachiko", kind: "local", title: "待つ力", text: "ハチ公の話は忠誠で有名ですが、日課と場所の記憶がとても強い動物だという側面もあります。", ...wikiCite("忠犬ハチ公") },
  { key: "local:smell-home", kind: "local", title: "帰巣", text: "犬は匂いと目印で道を覚えることがあります。引っ越し直後に脱走すると戻れないので、初期の管理が大切です。", ...wikiCite("帰巣本能") },
  { key: "local:two-dogs", kind: "local", title: "多頭飼い", text: "2頭いると散歩で名前を間違えても、匂いや歩幅で飼い主はすぐ気づきます。犬同士は、声より動きで区別しています。", ...wikiCite("イヌ") },
];

const POOL: DogSource[] = [
  ...WIKI_PAGES.map((page): WikiSource => ({ key: `wiki:${page}`, kind: "wiki", page })),
  ...LOCAL_FACTS,
];

function jstDateKey(ms = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function firstSentences(text: string, max = 180): string {
  const parts = text.split(/(?<=。)/);
  let out = "";
  for (const part of parts) {
    const next = part.trim();
    if (!next) continue;
    if (out && out.length + next.length > max) break;
    out += next;
    if (out.length >= 90) break;
  }
  return out || text.slice(0, max).trim();
}

function hashIndex(seed: string, size: number) {
  let hash = 7;
  for (const ch of seed) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  return size === 0 ? 0 : hash % size;
}

async function fetchWiki(page: string): Promise<DailyStory | null> {
  const res = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as { title?: string; description?: string; extract?: string };
  const text = firstSentences((payload.extract || payload.description || "").replace(/\s+/g, " ").trim());
  if (text.length < 20) return null;
  const title = payload.title || page;
  return {
    title,
    text,
    source: `Wikipedia「${title}」`,
    sourceUrl: `https://ja.wikipedia.org/wiki/${encodeURIComponent(page)}`,
  };
}

async function resolve(source: DogSource): Promise<DailyStory | null> {
  if (source.kind === "local") {
    return {
      title: source.title,
      text: source.text,
      source: source.source,
      sourceUrl: source.sourceUrl,
    };
  }
  return fetchWiki(source.page);
}

function byKey(key: string): DogSource | undefined {
  return POOL.find((item) => item.key === key);
}

async function remember(userId: string, factKey: string, dateKey: string) {
  const sql = await getSql();
  await sql`
    insert into user_dog_facts (user_id, fact_key, shown_on, shown_at)
    values (${userId}, ${factKey}, ${dateKey}::date, now())
    on conflict (user_id, fact_key) do update set
      shown_on = excluded.shown_on,
      shown_at = now()
  `;
}

export async function loadDogFact(userId: string, force: boolean): Promise<DailyStory> {
  const sql = await getSql();
  const dateKey = jstDateKey();
  await sql`delete from user_dog_facts where shown_at < now() - interval '31 days'`;

  if (!force) {
    const today = await sql<{ fact_key: string }>`
      select fact_key
      from user_dog_facts
      where user_id = ${userId} and shown_on = ${dateKey}::date
      order by shown_at desc
      limit 1
    `;
    const current = today[0] ? byKey(today[0].fact_key) : undefined;
    if (current) {
      const story = await resolve(current);
      if (story) return story;
    }
  }

  const recent = await sql<{ fact_key: string }>`
    select fact_key
    from user_dog_facts
    where user_id = ${userId} and shown_at > now() - interval '30 days'
  `;
  const used = new Set(recent.map((row) => row.fact_key));
  const unused = POOL.filter((item) => !used.has(item.key));
  const candidates = unused.length > 0 ? unused : POOL;
  const start = hashIndex(`${dateKey}:${userId}:${force ? `r:${Date.now()}` : "d"}`, candidates.length);

  for (let step = 0; step < candidates.length; step += 1) {
    const source = candidates[(start + step) % candidates.length]!;
    if (!force && used.has(source.key) && unused.length > 0) continue;
    const story = await resolve(source);
    if (!story) continue;
    await remember(userId, source.key, dateKey);
    return story;
  }

  const fallback = LOCAL_FACTS[hashIndex(dateKey, LOCAL_FACTS.length)]!;
  await remember(userId, fallback.key, dateKey);
  return {
    title: fallback.title,
    text: fallback.text,
    source: fallback.source,
    sourceUrl: fallback.sourceUrl,
  };
}
