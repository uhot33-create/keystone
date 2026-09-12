import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { todayJst } from "@/lib/walk/age";
import { isVisitKind, type VetVisit, type VisitKind } from "./types";

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "入力内容を確認してください");
  }
  return result.data;
}

function asDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    const iso = value.toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  }
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function asKind(value: string | null): VisitKind {
  return value && isVisitKind(value) ? value : "その他";
}

type VisitRow = {
  id: string;
  visit_on: unknown;
  clinic_name: string | null;
  kind: string;
  title: string;
  diagnosis: string | null;
  treatment: string | null;
  next_visit_on: unknown;
  cost_yen: number | null;
  note: string | null;
};

function mapVisit(row: VisitRow): VetVisit {
  return {
    id: row.id,
    visitOn: asDate(row.visit_on) || todayJst(),
    clinicName: row.clinic_name,
    kind: asKind(row.kind),
    title: row.title,
    diagnosis: row.diagnosis,
    treatment: row.treatment,
    nextVisitOn: asDate(row.next_visit_on),
    costYen: row.cost_yen == null ? null : Number(row.cost_yen),
    note: row.note,
  };
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付が正しくありません");

const visitInput = z.object({
  id: z.string().min(1).optional(),
  visitOn: isoDate,
  clinicName: z.string().trim().max(40).nullable(),
  kind: z.string().refine(isVisitKind, "種類を選んでください"),
  title: z.string().trim().min(1, "目的を入力してください").max(50),
  diagnosis: z.string().trim().max(200).nullable(),
  treatment: z.string().trim().max(200).nullable(),
  nextVisitOn: isoDate.nullable(),
  costYen: z.number().int().min(0).max(10_000_000).nullable(),
  note: z.string().trim().max(1000).nullable(),
});

export const listVetVisits = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<VisitRow>`
      select id, visit_on, clinic_name, kind, title, diagnosis, treatment, next_visit_on, cost_yen, note
      from vet_visits
      where user_id = ${context.userId}
      order by visit_on desc, updated_at desc
    `;
    return rows.map(mapVisit);
  });

export const getVetVisit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ id: z.string().min(1) }), input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<VisitRow>`
      select id, visit_on, clinic_name, kind, title, diagnosis, treatment, next_visit_on, cost_yen, note
      from vet_visits
      where id = ${data.id} and user_id = ${context.userId}
      limit 1
    `;
    if (!rows[0]) throw new Error("記録が見つかりません");
    return mapVisit(rows[0]);
  });

export const saveVetVisit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(visitInput, input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const clinic = data.clinicName?.trim() || null;
    const diagnosis = data.diagnosis?.trim() || null;
    const treatment = data.treatment?.trim() || null;
    const note = data.note?.trim() || null;
    const id = data.id ?? crypto.randomUUID();
    if (data.id) {
      const updated = await sql<{ id: string }>`
        update vet_visits
        set
          visit_on = ${data.visitOn},
          clinic_name = ${clinic},
          kind = ${data.kind},
          title = ${data.title},
          diagnosis = ${diagnosis},
          treatment = ${treatment},
          next_visit_on = ${data.nextVisitOn},
          cost_yen = ${data.costYen},
          note = ${note},
          updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
        returning id
      `;
      if (!updated[0]) throw new Error("記録が見つかりません");
    } else {
      await sql`
        insert into vet_visits (
          id, user_id, visit_on, clinic_name, kind, title, diagnosis, treatment, next_visit_on, cost_yen, note
        )
        values (
          ${id},
          ${context.userId},
          ${data.visitOn},
          ${clinic},
          ${data.kind},
          ${data.title},
          ${diagnosis},
          ${treatment},
          ${data.nextVisitOn},
          ${data.costYen},
          ${note}
        )
      `;
    }
    return { id };
  });

export const deleteVetVisit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ id: z.string().min(1) }), input))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const deleted = await sql<{ id: string }>`
      delete from vet_visits where id = ${data.id} and user_id = ${context.userId} returning id
    `;
    if (!deleted[0]) throw new Error("記録が見つかりません");
    return { ok: true as const };
  });
