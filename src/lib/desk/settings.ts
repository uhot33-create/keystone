import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type DeskVisibility = {
  onThisDay: boolean;
  quote: boolean;
  story: boolean;
  dogFact: boolean;
  dogNews: boolean;
  fortune: boolean;
};

type SettingsRow = {
  show_on_this_day: unknown;
  show_quote: unknown;
  show_story: unknown;
  show_dog_fact: unknown;
  show_dog_news: unknown;
  show_fortune: unknown;
};

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "t" || value === "true" || value === 1) return true;
  if (value === "f" || value === "false" || value === 0) return false;
  return fallback;
}

function mapRow(row: SettingsRow | undefined): DeskVisibility {
  if (!row) {
    return { onThisDay: false, quote: false, story: false, dogFact: false, dogNews: false, fortune: false };
  }
  return {
    onThisDay: asBool(row.show_on_this_day, false),
    quote: asBool(row.show_quote, false),
    story: asBool(row.show_story, false),
    dogFact: asBool(row.show_dog_fact, false),
    dogNews: asBool(row.show_dog_news, false),
    fortune: asBool(row.show_fortune, false),
  };
}

export const getUserSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<SettingsRow>`
      select show_on_this_day, show_quote, show_story, show_dog_fact, show_dog_news, show_fortune
      from user_settings
      where user_id = ${context.userId}
      limit 1
    `;
    return mapRow(rows[0]);
  });

const saveInput = z.object({
  onThisDay: z.boolean(),
  quote: z.boolean(),
  story: z.boolean(),
  dogFact: z.boolean(),
  dogNews: z.boolean(),
  fortune: z.boolean(),
});

export const saveUserSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = saveInput.safeParse(input);
    if (!parsed.success) throw new Error("設定を保存できませんでした");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into user_settings (
        user_id, show_on_this_day, show_quote, show_story, show_dog_fact, show_dog_news, show_fortune, updated_at
      )
      values (
        ${context.userId},
        ${data.onThisDay},
        ${data.quote},
        ${data.story},
        ${data.dogFact},
        ${data.dogNews},
        ${data.fortune},
        now()
      )
      on conflict (user_id) do update set
        show_on_this_day = excluded.show_on_this_day,
        show_quote = excluded.show_quote,
        show_story = excluded.show_story,
        show_dog_fact = excluded.show_dog_fact,
        show_dog_news = excluded.show_dog_news,
        show_fortune = excluded.show_fortune,
        updated_at = now()
    `;
    return data;
  });
