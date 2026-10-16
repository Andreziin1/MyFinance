import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { transactions } from "../../../../db/schema";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    const body = (await request.json()) as Record<string, unknown>;
    const description = String(body.description ?? "").trim();
    const category = String(body.category ?? "").trim();
    const paymentMethod = String(body.paymentMethod ?? "Outros").trim();
    const transactionDate = String(body.transactionDate ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const type = body.type === "income" ? "income" : "expense";
    const amountCents = Number(body.amountCents);

    if ((!Number.isSafeInteger(id) || id <= 0) || !description || !category || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
      return Response.json({ error: "Dados inválidos." }, { status: 400 });
    }
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return Response.json({ error: "Informe um valor maior que zero." }, { status: 400 });
    }

    const db = getDb();
    const [transaction] = await db.update(transactions).set({
      description, amountCents, type, category, paymentMethod, transactionDate, notes,
    }).where(eq(transactions.id, id)).returning();
    if (!transaction) return Response.json({ error: "Registro não encontrado. Atualize a página." }, { status: 404 });
    return Response.json({ transaction });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if ((!Number.isSafeInteger(id) || id <= 0)) return Response.json({ error: "ID inválido." }, { status: 400 });
    const db = getDb();
    const [deleted] = await db.delete(transactions).where(eq(transactions.id, id)).returning({ id: transactions.id });
    if (!deleted) return Response.json({ error: "Registro não encontrado. Atualize a página." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return Response.json({ error: message }, { status: 500 });
  }
}
