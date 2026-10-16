"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight,
  CreditCard, Download, Pencil, Plus, ReceiptText, Search,
  Trash2, Wallet, X,
} from "lucide-react";
import { AlertDialog } from "radix-ui";
import { parseAmountCents } from "../lib/money";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Transaction = {
  id: number;
  description: string;
  amountCents: number;
  type: "expense" | "income";
  category: string;
  paymentMethod: string;
  transactionDate: string;
  notes: string;
};

type FormState = Omit<Transaction, "id" | "amountCents"> & { amount: string };

const expenseCategories = ["Alimentação", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Compras", "Assinaturas", "Outros"];
const incomeCategories = ["Salário", "Freelance", "Investimentos", "Reembolso", "Outras receitas"];
const payments = ["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Boleto", "Transferência", "Outros"];
const colors = ["#e0614b", "#f2a65a", "#4d7c8a", "#8f6bb3", "#78a66a", "#d986a1", "#5378c3", "#b89b55", "#8b95a1"];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const dateLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function initialForm(): FormState {
  return { description: "", amount: "", type: "expense", category: "Alimentação", paymentMethod: "Pix", transactionDate: today(), notes: "" };
}
function categoryIcon(category: string) {
  const map: Record<string, string> = { "Alimentação": "🍽️", "Moradia": "🏠", "Transporte": "🚗", "Saúde": "💊", "Educação": "📚", "Lazer": "🎬", "Compras": "🛍️", "Assinaturas": "📱", "Salário": "💼", "Freelance": "💻", "Investimentos": "📈" };
  return map[category] ?? "📌";
}

export default function Home() {
  const now = new Date(today() + "T12:00:00Z");
  const [month, setMonth] = useState(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(initialForm());
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/transactions", { cache: "no-store" });
      const data = await response.json() as { transactions: Transaction[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar os lançamentos.");
      setItems(data.transactions);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const monthKey = month.toISOString().slice(0, 7);
  const monthly = useMemo(() => items.filter((i) => i.transactionDate.startsWith(monthKey)), [items, monthKey]);
  const expenses = monthly.filter((i) => i.type === "expense").reduce((sum, i) => sum + i.amountCents, 0);
  const income = monthly.filter((i) => i.type === "income").reduce((sum, i) => sum + i.amountCents, 0);
  const balance = income - expenses;
  const prevMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));
  const prevKey = prevMonth.toISOString().slice(0, 7);
  const prevExpenses = items.filter((i) => i.type === "expense" && i.transactionDate.startsWith(prevKey)).reduce((s, i) => s + i.amountCents, 0);
  const variation = prevExpenses ? ((expenses - prevExpenses) / prevExpenses) * 100 : null;

  const categoryData = useMemo(() => {
    const sums = new Map<string, number>();
    monthly.filter((i) => i.type === "expense").forEach((i) => sums.set(i.category, (sums.get(i.category) ?? 0) + i.amountCents));
    return Array.from(sums, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthly]);

  const visible = monthly.filter((i) => {
    const term = search.toLowerCase();
    return (categoryFilter === "Todas" || i.category === categoryFilter) && (i.description.toLowerCase().includes(term) || i.category.toLowerCase().includes(term));
  });

  function changeMonth(delta: number) { setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1))); }
  function openNew() { setEditingId(null); setForm({ ...initialForm(), transactionDate: today().startsWith(monthKey) ? today() : monthKey + "-01" }); setError(""); setModal(true); }
  function openEdit(item: Transaction) {
    setEditingId(item.id);
    setForm({ description: item.description, amount: (item.amountCents / 100).toFixed(2).replace(".", ","), type: item.type, category: item.category, paymentMethod: item.paymentMethod, transactionDate: item.transactionDate, notes: item.notes });
    setError(""); setModal(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const amountCents = parseAmountCents(form.amount);
    if (amountCents === null) { setError("Informe um valor válido, como 150,50."); setSaving(false); return; }
    try {
      const response = await fetch(editingId ? `/api/transactions/${editingId}` : "/api/transactions", {
        method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amountCents }),
      });
      const data = await response.json() as { transaction?: Transaction; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");
      if (!data.transaction) throw new Error("Não foi possível confirmar a alteração. Tente novamente.");
      const saved = data.transaction;
      setItems(current => editingId ? current.map(item => item.id === editingId ? saved : item) : [saved, ...current]);
      setNotice(editingId ? "Registro atualizado. Os totais e gráficos foram recalculados." : "Registro adicionado.");
      setMonth(new Date(form.transactionDate.slice(0, 7) + "-01T12:00:00Z")); setModal(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar."); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!pendingDelete || deleting) return;
    setDeleting(true); setDeleteError(""); setNotice("");
    try {
      const response = await fetch(`/api/transactions/${pendingDelete.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || "Não foi possível excluir. Tente novamente.");
      }
      setItems(current => current.filter(item => item.id !== pendingDelete.id));
      setPendingDelete(null);
      setNotice("Registro excluído. Os totais e gráficos foram recalculados.");
    } catch (e) { setDeleteError(e instanceof Error ? e.message : "Não foi possível excluir. Tente novamente."); }
    finally { setDeleting(false); }
  }

  function exportCsv() {
    const header = ["Data", "Tipo", "Descrição", "Categoria", "Pagamento", "Valor", "Observações"];
    const rows = visible.map((i) => [i.transactionDate, i.type === "expense" ? "Despesa" : "Receita", i.description, i.category, i.paymentMethod, (i.amountCents / 100).toFixed(2).replace(".", ","), i.notes]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `lancamentos-${monthKey}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-[#17241f]">
      <header className="border-b border-black/5 bg-[#f6f8f7]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 py-5 lg:px-9">
          <div className="flex items-center gap-2.5"><img src="/myfinance-logo.svg" width={38} height={38} alt=""/><span className="text-xl font-semibold tracking-tight">My<span className="text-[#237559]">Finance</span></span></div>
          <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-[#173e34] px-3 py-3 text-sm font-semibold text-white transition hover:bg-[#215345] sm:px-5"><Plus size={18}/> Adicionar gasto</button>
        </div>
      </header>

      <div className="mx-auto max-w-[1120px] px-5 py-8 lg:px-9">
        <section className="min-w-0">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Suas finanças do mês</h1><p className="mt-2 text-sm text-[#617069]">Quanto entrou, quanto saiu e onde você gastou.</p></div>
            <div className="flex items-center gap-1 rounded-full border border-black/5 bg-white p-1 shadow-sm"><button onClick={() => changeMonth(-1)} aria-label="Mês anterior" className="rounded-full p-2 hover:bg-[#f3f1ec]"><ChevronLeft size={18}/></button><div className="min-w-40 px-3 text-center text-sm font-semibold capitalize">{monthLabel.format(month)}</div><button onClick={() => changeMonth(1)} aria-label="Próximo mês" className="rounded-full p-2 hover:bg-[#f3f1ec]"><ChevronRight size={18}/></button></div>
          </div>

          {notice && <p role="status" className="mb-4 rounded-xl bg-[#edf5f0] px-4 py-3 text-sm text-[#173e34]">{notice}</p>}
          {error && !modal && <div className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Entradas" value={brl.format(income / 100)} icon={<ArrowUpRight size={20}/>} tone="green" note="Dinheiro recebido"/>
            <Metric label="Gastos" value={brl.format(expenses / 100)} icon={<ArrowDownRight size={20}/>} tone="coral" note="Despesas registradas"/>
            <Metric label="Saldo do mês" value={brl.format(balance / 100)} icon={<Wallet size={20}/>} tone="dark" note="Entradas menos gastos"/>
          </div>
          {variation !== null && <p className="mt-3 text-sm text-[#617069]">{variation === 0 ? "Seus gastos são iguais aos do mês anterior." : `Você gastou ${Math.abs(variation).toFixed(1).replace(".", ",")}% ${variation < 0 ? "menos" : "mais"} que no mês anterior.`}</p>}

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-[#e4eae6] bg-white p-5 sm:p-7">
              <div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">Onde você gastou</h2><p className="mt-1 text-xs text-[#87918c]">Participação de cada categoria no total</p></div><div className="rounded-xl bg-[#f6f8f7] p-2 text-[#4d7c8a]"><CreditCard size={18}/></div></div>
              {categoryData.length ? <div className="mt-4 grid items-center grid-cols-1">
                <div className="relative h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={53} outerRadius={78} paddingAngle={3} stroke="none">{categoryData.map((entry, i) => <Cell key={entry.name} fill={colors[i % colors.length]}/>)}</Pie><Tooltip formatter={(value) => brl.format(Number(value) / 100)} contentStyle={{borderRadius: 14, border: "none", boxShadow: "0 8px 24px #0002"}}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="text-[10px] uppercase tracking-wider text-[#9aa29e]">Total</p><p className="text-sm font-bold">{brl.format(expenses / 100)}</p></div></div></div>
                <div className="space-y-3">{categoryData.map((entry, i) => <div key={entry.name} className="flex items-center gap-3 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{background: colors[i % colors.length]}}/><span className="flex-1 text-[#617069]">{entry.name}</span><span className="font-semibold">{brl.format(entry.value / 100)}</span><span className="w-10 text-right text-xs text-[#9aa29e]">{expenses ? Math.round(entry.value / expenses * 100) : 0}%</span></div>)}</div>
              </div> : <EmptyChart onAdd={openNew}/>} 
            </article>

            <article className="rounded-2xl border border-[#e4eae6] bg-white p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-lg font-semibold">Maiores gastos</h2><p className="mt-1 text-xs text-[#87918c]">As 5 categorias com mais despesas</p></div></div>
              <div className="mt-7 space-y-5">{categoryData.slice(0, 5).map((entry, i) => <div key={entry.name}><div className="mb-2 flex items-center justify-between text-sm"><div className="flex items-center gap-2"><span>{categoryIcon(entry.name)}</span><span className="font-medium">{entry.name}</span></div><span className="font-semibold">{brl.format(entry.value / 100)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f0eee9]"><div className="h-full rounded-full transition-all" style={{width: `${expenses ? (entry.value / expenses) * 100 : 0}%`, background: colors[i % colors.length]}}/></div></div>)}{!categoryData.length && <div className="grid min-h-52 place-items-center text-center text-sm text-[#8a948f]">Adicione despesas para comparar suas categorias.</div>}</div>
            </article>
          </div>

          <details className="mt-6 overflow-hidden rounded-2xl border border-[#e4eae6] bg-white">
            <summary className="cursor-pointer px-5 py-5 text-sm font-semibold sm:px-7">Ver gastos e receitas do mês <span className="ml-2 font-normal text-[#617069]">({monthly.length})</span></summary>
            <div className="flex flex-col gap-4 border-b border-[#eeece7] p-5 sm:p-7"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Seus registros</h2><p className="mt-1 text-xs text-[#87918c]">{visible.length} {visible.length === 1 ? "registro encontrado" : "registros encontrados"}</p></div><button onClick={exportCsv} disabled={!visible.length} className="flex items-center gap-2 rounded-full border border-[#e8e5de] px-4 py-2 text-xs font-semibold disabled:opacity-40"><Download size={15}/> Exportar CSV</button></div>
              <div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa29e]" size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar por descrição" placeholder="Buscar por descrição..." className="w-full rounded-xl border border-[#e8e5de] bg-[#faf9f6] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#4d7c8a]"/></label><select aria-label="Filtrar por categoria" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-xl border border-[#e8e5de] bg-[#faf9f6] px-4 py-2.5 text-sm outline-none"><option value="Todas">Todas as categorias</option>{[...expenseCategories, ...incomeCategories].map(c => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div className="divide-y divide-[#f0eee9]">{loading ? <div className="p-10 text-center text-sm text-[#8a948f]">Carregando seus registros...</div> : visible.length ? visible.map((item) => <div key={item.id} className="group flex flex-wrap items-center gap-2 sm:gap-4 px-5 py-4 transition hover:bg-[#faf9f6] sm:px-7"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f4f1eb] text-xl">{categoryIcon(item.category)}</div><div className="min-w-[100px] flex-1"><p className="truncate text-sm font-semibold">{item.description}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#8b9590]"><span>{dateLabel.format(new Date(item.transactionDate + "T00:00:00Z"))}</span><span>•</span><span>{item.type === "income" ? "Receita" : "Gasto"}</span><span>•</span><span>{item.category}</span><span>•</span><span>{item.paymentMethod}</span></div></div><div className="text-right"><p className={`text-sm font-bold ${item.type === "expense" ? "text-[#c15340]" : "text-[#2f7a58]"}`}>{item.type === "expense" ? "−" : "+"} {brl.format(item.amountCents / 100)}</p></div><div className="flex gap-1 opacity-100"><button onClick={() => openEdit(item)} aria-label={`Editar ${item.description}`} className="flex items-center gap-1.5 rounded-lg border border-[#e4eae6] px-3 py-2 text-xs font-medium text-[#173e34] hover:bg-[#edf5f0]"><Pencil size={15}/> Editar</button><button onClick={() => { setPendingDelete(item); setDeleteError(""); setNotice(""); }} aria-label={`Excluir ${item.description}`} className="flex items-center gap-1.5 rounded-lg border border-[#eedbd7] px-3 py-2 text-xs font-medium text-[#a43d2c] hover:bg-red-50"><Trash2 size={15}/> Excluir</button></div></div>) : <div className="grid min-h-48 place-items-center p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f4f1eb] text-[#718079]"><CalendarDays size={21}/></div><p className="mt-3 text-sm font-semibold">Nenhum registro neste mês</p><button onClick={openNew} className="mt-2 text-xs font-semibold text-[#d15a45]">Adicionar o primeiro</button></div></div>}</div>
          </details>
        </section>
      </div>

      {modal && <div className="fixed inset-0 z-50 grid place-items-end bg-[#10201a]/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(false); }}><form onSubmit={save} className="max-h-[95vh] w-full overflow-y-auto rounded-t-2xl bg-[#fbfaf7] p-6 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d35d48]">{editingId ? "Editar registro" : "Novo registro"}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{editingId ? (form.type === "expense" ? "Editar gasto" : "Editar receita") : (form.type === "expense" ? "Adicionar gasto" : "Adicionar receita")}</h2></div><button type="button" aria-label="Fechar" onClick={() => setModal(false)} className="rounded-full bg-[#efede7] p-2"><X size={18}/></button></div>
        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-[#efede7] p-1"><button type="button" onClick={() => setForm({...form, type:"expense", category:"Alimentação"})} className={`rounded-xl py-2.5 text-sm font-semibold ${form.type === "expense" ? "bg-white text-[#c15340] shadow-sm" : "text-[#78827d]"}`}>Gasto</button><button type="button" onClick={() => setForm({...form, type:"income", category:"Salário"})} className={`rounded-xl py-2.5 text-sm font-semibold ${form.type === "income" ? "bg-white text-[#2f7a58] shadow-sm" : "text-[#78827d]"}`}>Receita</button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label={form.type === "expense" ? "Com o que foi?" : "De onde veio?"} wide><input required value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Ex.: Supermercado"/></Field><Field label="Valor (R$)"><input required inputMode="decimal" value={form.amount} onChange={e => setForm({...form, amount:e.target.value})} placeholder="0,00"/></Field><Field label="Data"><input required type="date" value={form.transactionDate} onChange={e => setForm({...form, transactionDate:e.target.value})}/></Field><Field label="Categoria"><select value={form.category} onChange={e => setForm({...form, category:e.target.value})}>{(form.type === "expense" ? expenseCategories : incomeCategories).map(c => <option key={c}>{c}</option>)}</select></Field><Field label={form.type === "expense" ? "Como pagou?" : "Como recebeu?"}><select value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod:e.target.value})}>{payments.map(p => <option key={p}>{p}</option>)}</select></Field><Field label="Observações" wide><textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} placeholder="Opcional"/></Field></div>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<div className="mt-7 flex gap-3"><button type="button" onClick={() => setModal(false)} className="flex-1 rounded-full border border-[#dedbd3] py-3 text-sm font-semibold">Cancelar</button><button disabled={saving} className="flex-1 rounded-full bg-[#173e34] py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar"}</button></div>
      </form></div>}
      <AlertDialog.Root open={pendingDelete !== null} onOpenChange={open => { if (!open && !deleting) setPendingDelete(null); }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-[#10201a]/45 backdrop-blur-sm"/>
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 text-[#17241f] shadow-xl" onEscapeKeyDown={event => { if (deleting) event.preventDefault(); }}>
            <AlertDialog.Title className="text-xl font-semibold">Excluir {pendingDelete?.type === "income" ? "receita" : "gasto"}?</AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-sm text-[#617069]">
              {pendingDelete?.description} — {brl.format((pendingDelete?.amountCents ?? 0) / 100)}. Este registro será removido e os totais do mês serão atualizados.
            </AlertDialog.Description>
            {deleteError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{deleteError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <AlertDialog.Cancel disabled={deleting} className="rounded-xl border border-[#e4eae6] px-4 py-3 text-sm font-medium disabled:opacity-50">Cancelar</AlertDialog.Cancel>
              <button onClick={remove} disabled={deleting} className="rounded-xl bg-[#a43d2c] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{deleting ? "Excluindo..." : "Confirmar exclusão"}</button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </main>
  );
}

function Metric({ label, value, note, icon, tone }: { label:string; value:string; note:string; icon:React.ReactNode; tone:"dark"|"green"|"coral"|"sand" }) {
  const styles = { dark:"bg-[#edf5f0] border border-[#dbe8df] text-[#173e34]", green:"bg-white border border-[#e4eae6] text-[#214b3a]", coral:"bg-white border border-[#e4eae6] text-[#773e33]", sand:"bg-white text-[#554b32]" };
  return <article className={`rounded-2xl p-5 ${styles[tone]}`}><div className="flex items-start justify-between"><div className="text-sm font-medium">{label}</div><div className="opacity-75">{icon}</div></div><p className="mt-3 break-words text-2xl font-semibold tracking-[-.03em]">{value}</p><p className="mt-2 text-xs text-[#617069]">{note}</p></article>;
}
function Field({ label, wide, children }: {label:string; wide?:boolean; children:React.ReactNode}) { return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-xs font-semibold text-[#56625c]">{label}</span><div className="[&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-[#dedbd3] [&_input]:bg-white [&_input]:px-3 [&_input]:py-3 [&_input]:text-sm [&_input]:outline-none [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-[#dedbd3] [&_select]:bg-white [&_select]:px-3 [&_select]:py-3 [&_select]:text-sm [&_textarea]:w-full [&_textarea]:resize-none [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-[#dedbd3] [&_textarea]:bg-white [&_textarea]:px-3 [&_textarea]:py-3 [&_textarea]:text-sm [&_textarea]:outline-none">{children}</div></label>; }
function EmptyChart({onAdd}:{onAdd:()=>void}) { return <div className="grid min-h-64 place-items-center text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f4f1eb] text-[#8a948f]"><ReceiptText size={21}/></div><p className="mt-3 text-sm font-semibold">Seu gráfico aparecerá aqui</p><p className="mt-1 text-xs text-[#929b97]">Cadastre uma despesa para começar.</p><button onClick={onAdd} className="mt-3 text-xs font-bold text-[#d15a45]">Adicionar gasto</button></div></div>; }
