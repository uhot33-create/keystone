import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { todayJst } from "@/lib/walk/age";
import { isVisitKind, isVisitStatus, type VetVisit, type VisitKind, type VisitStatus } from "./types";

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

function asStatus(value: string | null): VisitStatus {
  return value && isVisitStatus(value) ? value : "done";
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
  status: string | null;
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
    status: asStatus(row.status),
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
  status: z.enum(["planned", "done"]).default("done"),
});

async function findByDateClinic(
  sql: Sql,
  userId: string,
  visitOn: string,
  clinic: string | null,
  status?: VisitStatus,
): Promise<string | null> {
  const rows = status
    ? await sql<{ id: string }>`
        select id from vet_visits
        where user_id = ${userId}
          and visit_on = ${visitOn}
          and coalesce(btrim(clinic_name), '') = coalesce(${clinic}, '')
          and status = ${status}
        limit 1
      `
    : await sql<{ id: string }>`
        select id from vet_visits
        where user_id = ${userId}
          and visit_on = ${visitOn}
          and coalesce(btrim(clinic_name), '') = coalesce(${clinic}, '')
        limit 1
      `;
  return rows[0]?.id ?? null;
}

async function upsertPlanned(
  sql: Sql,
  userId: string,
  data: { visitOn: string; clinicName: string | null; kind: string; title: string },
) {
  const today = todayJst();
  if (data.visitOn < today) return;
  const existing = await findByDateClinic(sql, userId, data.visitOn, data.clinicName);
  if (existing) return;
  await sql`
    insert into vet_visits (
      id, user_id, visit_on, clinic_name, kind, title, status
    )
    values (
      ${crypto.randomUUID()},
      ${userId},
      ${data.visitOn},
      ${data.clinicName},
      ${data.kind},
      ${data.title},
      'planned'
    )
  `;
}

async function clearMatchedPlans(sql: Sql, userId: string, visitOn: string, clinic: string | null, keepId: string) {
  await sql`
    update vet_visits
    set next_visit_on = null, updated_at = now()
    where user_id = ${userId}
      and id <> ${keepId}
      and next_visit_on = ${visitOn}
      and coalesce(btrim(clinic_name), '') = coalesce(${clinic}, '')
  `;
}

export const listVetVisits = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<VisitRow>`
      select id, visit_on, clinic_name, kind, title, diagnosis, treatment, next_visit_on, cost_yen, note, status
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
      select id, visit_on, clinic_name, kind, title, diagnosis, treatment, next_visit_on, cost_yen, note, status
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
    let status: VisitStatus = data.status;
    const diagnosis = status === "planned" ? null : data.diagnosis?.trim() || null;
    const treatment = status === "planned" ? null : data.treatment?.trim() || null;
    const note = data.note?.trim() || null;
    const nextVisitOn = status === "planned" ? null : data.nextVisitOn;
    const costYen = status === "planned" ? null : data.costYen;
    let id = data.id ?? null;
    if (!id && status === "done") {
      id = await findByDateClinic(sql, context.userId, data.visitOn, clinic, "planned");
    }
    const writingId = id ?? crypto.randomUUID();
    if (id) {
      const updated = await sql<{ id: string }>`
        update vet_visits
        set
          visit_on = ${data.visitOn},
          clinic_name = ${clinic},
          kind = ${data.kind},
          title = ${data.title},
          diagnosis = ${diagnosis},
          treatment = ${treatment},
          next_visit_on = ${nextVisitOn},
          cost_yen = ${costYen},
          note = ${note},
          status = ${status},
          updated_at = now()
        where id = ${id} and user_id = ${context.userId}
        returning id
      `;
      if (!updated[0]) throw new Error("記録が見つかりません");
    } else {
      await sql`
        insert into vet_visits (
          id, user_id, visit_on, clinic_name, kind, title, diagnosis, treatment, next_visit_on, cost_yen, note, status
        )
        values (
          ${writingId},
          ${context.userId},
          ${data.visitOn},
          ${clinic},
          ${data.kind},
          ${data.title},
          ${diagnosis},
          ${treatment},
          ${nextVisitOn},
          ${costYen},
          ${note},
          ${status}
        )
      `;
    }
    if (status === "done") {
      await clearMatchedPlans(sql, context.userId, data.visitOn, clinic, writingId);
      if (nextVisitOn && nextVisitOn !== data.visitOn) {
        await upsertPlanned(sql, context.userId, {
          visitOn: nextVisitOn,
          clinicName: clinic,
          kind: data.kind,
          title: data.title,
        });
      }
    }
    return { id: writingId };
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
