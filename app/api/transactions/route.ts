import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { transactions } from "../../../db/schema";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(transactions)
      .orderBy(desc(transactions.transactionDate), desc(transactions.id)).limit(2500);
    return Response.json({ transactions: rows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const description = String(body.description ?? "").trim();
    const category = String(body.category ?? "").trim();
    const paymentMethod = String(body.paymentMethod ?? "Outros").trim();
    const transactionDate = String(body.transactionDate ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const type = body.type === "income" ? "income" : "expense";
    const amountCents = Number(body.amountCents);

    if (!description || !category || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
      return Response.json({ error: "Preencha descrição, categoria e data." }, { status: 400 });
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return Response.json({ error: "Informe um valor maior que zero." }, { status: 400 });
    }

    const db = getDb();
    const [transaction] = await db.insert(transactions).values({
      description, amountCents, type, category, paymentMethod, transactionDate, notes,
    }).returning();
    return Response.json({ transaction }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
