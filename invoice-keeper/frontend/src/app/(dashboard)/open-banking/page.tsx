"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ArrowDownLeft, ArrowUpRight, Bell, Check, CircleDollarSign, Landmark, Link2, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";

type Account = { id:number; provider:string; institution_name:string; account_name:string; iban_masked:string; currency:string; balance:string; status:string; consent_expires_at:string };
type Transaction = { id:number; booked_at:string; amount:string; currency:string; direction:string; counterparty:string; description:string; external_id:string; match?: { id:number; occurrence_id:number; confidence:number; status:string; reason:string } | null };
type Match = { id:number; status:string; confidence:number; reason:string; transaction:Transaction|null; occurrence:{id:number;name:string;amount:string;currency:string;due_date:string;is_paid:boolean}|null };
type Notification = {id:number;title:string;message:string;kind:string;is_read:boolean;created_at:string};
type Overview = {mode:string;provider:string;accounts_count:number;transactions_count:number;suggested_matches:number;confirmed_matches:number;unread_notifications:number;notice:string};

function getApiErrorDetail(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return undefined;
  }
  const response = error.response;
  if (typeof response !== "object" || response === null || !("data" in response)) {
    return undefined;
  }
  const data = response.data;
  if (
    typeof data === "object" &&
    data !== null &&
    "detail" in data &&
    typeof data.detail === "string"
  ) {
    return data.detail;
  }
  return undefined;
}

const money=(v:string|number,currency="EUR")=>new Intl.NumberFormat("en-IE",{style:"currency",currency,maximumFractionDigits:2}).format(Number(v)||0);
const date=(v:string)=>new Date(v).toLocaleDateString("en-IE",{day:"2-digit",month:"short",year:"numeric"});

export default function OpenBankingPage() {
  const [overview,setOverview]=useState<Overview|null>(null);
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [transactions,setTransactions]=useState<Transaction[]>([]);
  const [matches,setMatches]=useState<Match[]>([]);
  const [notifications,setNotifications]=useState<Notification[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  const load=useCallback(async()=>{
    setError("");
    try {
      const [o,a,t,m,n]=await Promise.all([
        api.get("/open-banking/overview"),api.get("/open-banking/accounts"),
        api.get("/open-banking/transactions"),api.get("/open-banking/matches"),
        api.get("/open-banking/notifications")
      ]);
      setOverview(o.data);setAccounts(a.data.items||[]);setTransactions(t.data.items||[]);
      setMatches(m.data.items||[]);setNotifications(n.data.items||[]);
    } catch(e: unknown) {
      setError(getApiErrorDetail(e) || "Не удалось загрузить Open Banking. Убедитесь, что backend обновлён и вы вошли в систему.");
    }
  },[]);
  useEffect(()=>{void load();},[load]);

  const action=async(path:string,body?:unknown,success="Готово")=>{
    setBusy(true);setError("");setMessage("");
    try {await api.post(path,body??{});setMessage(success);await load();}
    catch(e: unknown){setError(getApiErrorDetail(e)||"Операция не выполнена");}
    finally{setBusy(false);}
  };

  return <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 pb-16 text-white">
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">PSD2 SANDBOX</span>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">Демо-режим</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Open Banking</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Демо-счета, тестовые транзакции, автоматические предложения сверки и уведомления. Реальные банковские данные не используются.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={()=>void action("/open-banking/demo/connect",{},"Демо-банк подключён")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"><Link2 size={16}/> Подключить демо-банк</button>
        <button disabled={busy} onClick={()=>void action("/open-banking/demo/sync",{},"Тестовые транзакции обновлены")} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 disabled:opacity-50"><RefreshCw size={16}/> Синхронизировать</button>
        <button disabled={busy} onClick={()=>void action("/open-banking/match/auto",{},"Поиск совпадений завершён")} className="inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-2.5 text-sm text-violet-100 hover:bg-violet-400/20 disabled:opacity-50"><Sparkles size={16}/> Найти совпадения</button>
      </div>
    </div>

    {error && <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
    {message && <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</div>}
    <div className="mb-6 flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100/90"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/><div><b>Безопасный sandbox.</b> Нет реального подключения к банку, инициирования платежей или хранения банковских логинов. Перед подтверждением сверки пользователь должен проверить предложенное совпадение.</div></div>

    <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {label:"Подключённые счета",value:overview?.accounts_count??"—",icon:Landmark},
        {label:"Импортированные транзакции",value:overview?.transactions_count??"—",icon:ArrowDownLeft},
        {label:"Ожидают сверки",value:overview?.suggested_matches??"—",icon:CircleDollarSign},
        {label:"Непрочитанные уведомления",value:overview?.unread_notifications??"—",icon:Bell},
      ].map(x=><article key={x.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5"><div className="mb-4 flex items-center justify-between text-sm text-neutral-400"><span>{x.label}</span><x.icon className="h-4 w-4"/></div><div className="text-3xl font-semibold">{x.value}</div></article>)}
    </section>

    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Банковские счета</h2><span className="text-xs text-neutral-500">{accounts.length} счет(ов)</span></div>
      {accounts.length===0?<div className="rounded-2xl border border-dashed border-white/15 p-8 text-center"><Landmark className="mx-auto mb-3 h-8 w-8 text-neutral-500"/><p className="font-medium">Демо-банк ещё не подключён</p><p className="mt-1 text-sm text-neutral-500">Нажмите «Подключить демо-банк», чтобы создать тестовые счета и транзакции.</p></div>:
      <div className="grid gap-3 md:grid-cols-2">{accounts.map(a=><article key={a.id} className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-transparent p-5"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-200"><Landmark size={19}/></div><div><div className="font-medium">{a.account_name}</div><div className="mt-1 text-xs text-neutral-500">{a.institution_name} · {a.iban_masked}</div></div></div><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-200">{a.status}</span></div><div className="mt-5 text-2xl font-semibold">{money(a.balance,a.currency)}</div><div className="mt-2 flex justify-between text-xs text-neutral-500"><span>Валюта: {a.currency}</span><span>Consent истекает: {date(a.consent_expires_at)}</span></div></article>)}</div>}
    </section>

    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Сверка платежей</h2><span className="text-xs text-neutral-500">Статус платежа не меняется до подтверждения</span></div>
      {matches.length===0?<div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 text-sm text-neutral-500">Совпадений пока нет. Подключите демо-банк и нажмите «Найти совпадения». Для совпадения нужны одинаковые сумма и валюта, а также дата платежа в пределах 14 дней.</div>:
      <div className="space-y-3">{matches.map(m=><article key={m.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{m.transaction?.counterparty||"Транзакция"}</span><span className="rounded-full bg-violet-400/10 px-2 py-1 text-xs text-violet-200">{m.confidence}% совпадение</span><span className={`rounded-full px-2 py-1 text-xs ${m.status==="confirmed"?"bg-emerald-400/10 text-emerald-200":m.status==="dismissed"?"bg-neutral-700 text-neutral-300":"bg-amber-400/10 text-amber-200"}`}>{m.status==="confirmed"?"Подтверждено":m.status==="dismissed"?"Отклонено":"Ожидает проверки"}</span></div><p className="mt-2 text-sm text-neutral-300">{m.occurrence?.name||"Платёж"} · {m.transaction?money(m.transaction.amount,m.transaction.currency):"—"} · {m.transaction?date(m.transaction.booked_at):""}</p><p className="mt-1 text-xs text-neutral-500">{m.reason}</p></div>{m.status==="suggested"&&<div className="flex shrink-0 gap-2"><button disabled={busy} onClick={()=>void action(`/open-banking/matches/${m.id}/confirm`,{mark_paid:true},"Совпадение подтверждено; платёж отмечен оплаченным")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"><Check size={15}/> Подтвердить</button><button disabled={busy} onClick={()=>void action(`/open-banking/matches/${m.id}/confirm`,{mark_paid:false},"Совпадение отклонено")} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"><X size={15}/> Отклонить</button></div>}</div></article>)}</div>}
    </section>

    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Транзакции</h2><span className="text-xs text-neutral-500">{transactions.length} записей</span></div>
      <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
        <table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Дата</th><th className="px-4 py-3">Контрагент</th><th className="px-4 py-3">Описание</th><th className="px-4 py-3 text-right">Сумма</th><th className="px-4 py-3">Сверка</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id} className="border-t border-white/[0.06]"><td className="whitespace-nowrap px-4 py-3 text-neutral-400">{date(t.booked_at)}</td><td className="px-4 py-3 font-medium">{t.direction==="credit"?<ArrowDownLeft className="mr-2 inline h-4 w-4 text-emerald-300"/>:<ArrowUpRight className="mr-2 inline h-4 w-4 text-rose-300"/>}{t.counterparty}</td><td className="px-4 py-3 text-neutral-400">{t.description}</td><td className={`whitespace-nowrap px-4 py-3 text-right font-medium ${t.direction==="credit"?"text-emerald-200":"text-neutral-100"}`}>{t.direction==="debit"?"−":"+"}{money(t.amount,t.currency)}</td><td className="px-4 py-3">{t.match?<span className="text-xs text-amber-200">{t.match.status==="suggested"?"Есть предложение":t.match.status==="confirmed"?"Подтверждено":"Отклонено"}</span>:<span className="text-xs text-neutral-600">—</span>}</td></tr>)}</tbody></table>
      </div>
    </section>

    <section>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Уведомления</h2><span className="text-xs text-neutral-500">{notifications.length} записей</span></div>
      <div className="space-y-2">{notifications.length===0?<p className="rounded-xl border border-white/[0.08] p-5 text-sm text-neutral-500">Пока нет уведомлений.</p>:notifications.map(n=><div key={n.id} className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><Bell className="mt-0.5 h-4 w-4 shrink-0 text-blue-300"/><div className="min-w-0 flex-1"><div className="font-medium">{n.title}</div><p className="mt-1 text-sm text-neutral-400">{n.message}</p><p className="mt-1 text-xs text-neutral-600">{new Date(n.created_at).toLocaleString()}</p></div>{!n.is_read&&<button onClick={()=>void action(`/open-banking/notifications/${n.id}/read`,{},"Уведомление прочитано")} className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/5">Прочитано</button>}</div>)}</div>
    </section>
  </main>;
}
