import { useMemo, useState } from "react";
import { CalendarDays, Pencil, Scale, Trash2, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "../App.jsx";
import { api, displayWeightUnit, fromKg, localDate, notify, toKg } from "../api.js";
import { AddButton, Button, ConfirmDelete, EmptyState, ErrorState, FormField, LoadingState, Modal, PageHeading, useResource } from "../components.jsx";

function WeightForm({ initial, units, onClose, onSaved }) {
  const [form, setForm] = useState({ date: initial?.date?.slice(0, 10) ?? localDate(), weight: fromKg(initial?.weightKg, units), notes: initial?.notes ?? "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { date: form.date, weightKg: toKg(form.weight, units), notes: form.notes };
      if (initial?._id) await api(`/weights/${initial._id}`, { method: "PUT", body });
      else await api("/weights", { method: "POST", body });
      onSaved();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  return <Modal title={initial ? "Edit weigh-in" : "Log a weigh-in"} subtitle="There's no required schedule. Record when it feels useful." onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      <div className="field-row"><FormField label="Date"><input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></FormField><FormField label={`Weight (${displayWeightUnit(units)})`}><input type="number" min={units === "imperial" ? 55 : 25} max={units === "imperial" ? 772 : 350} step="0.1" required value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} /></FormField></div>
      <FormField label="Note" hint="Optional · visible only to you"><textarea rows="2" maxLength="500" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Anything you'd like to remember?" /></FormField>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : "Save weigh-in"}</Button></div>
    </form>
  </Modal>;
}

export default function Progress() {
  const { user } = useApp();
  const [range, setRange] = useState(30);
  const [modal, setModal] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resource = useResource("/weights", []);
  const profileResource = useResource("/profile", []);
  const entries = resource.data?.weightEntries ?? [];
  const profile = profileResource.data?.profile ?? user;
  const latest = entries[0];
  const chartData = useMemo(() => {
    const today = new Date(`${localDate()}T00:00:00`);
    const start = new Date(today);
    start.setDate(today.getDate() - range + 1);
    const byDate = new Map();
    for (const entry of entries) {
      const key = entry.date.slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, fromKg(entry.weightKg, user.unitSystem));
    }
    return Array.from({ length: range }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = localDate(date);
      return { date: key, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), weight: byDate.get(key) ?? null };
    });
  }, [entries, range, user.unitSystem]);

  async function remove() {
    setBusy(true);
    try { await api(`/weights/${deleteItem._id}`, { method: "DELETE" }); setDeleteItem(null); resource.refresh(); profileResource.refresh(); notify("Weigh-in deleted."); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return <div className="page-stack">
    <PageHeading eyebrow="NOTICE YOUR PROGRESS" title="Progress" description="Your body is not a score. These are just a few data points." action={<AddButton onClick={() => setModal({ type: "edit", value: null })}>Log weight</AddButton>} />
    <div className="progress-stat-row">
      <article className="progress-stat-card"><div className="stat-icon stat-icon-blue"><Scale size={18} /></div><span>Latest weight</span><strong>{latest ? `${fromKg(latest.weightKg, user.unitSystem)} ${displayWeightUnit(user.unitSystem)}` : "—"}</strong><small>{latest ? `Logged ${latest.date.slice(0, 10)}` : "No weigh-in yet"}</small></article>
      <article className="progress-stat-card"><div className="stat-icon stat-icon-green"><TrendingUp size={18} /></div><span>Height on profile</span><strong>{profile.heightCm ? `${(profile.heightCm / (user.unitSystem === "imperial" ? 2.54 : 1)).toFixed(1)} ${user.unitSystem === "imperial" ? "in" : "cm"}` : "—"}</strong><small>Update this in your profile</small></article>
      <article className="progress-stat-card"><div className="stat-icon stat-icon-orange"><CalendarDays size={18} /></div><span>BMI</span><strong>{latest && profile.heightCm ? (latest.weightKg / ((profile.heightCm / 100) ** 2)).toFixed(1) : "—"}</strong><small>BMI is a limited screening measure, not a diagnosis.</small></article>
    </div>
    <section className="panel chart-panel progress-chart-panel">
      <div className="panel-heading"><div><span className="eyebrow">WEIGHT TREND</span><h2>Keep the long view</h2><p>Only dates with a weigh-in show a point.</p></div><div className="segmented-control" role="group" aria-label="Weight chart range"><button type="button" aria-pressed={range === 7} className={range === 7 ? "segment-active" : ""} onClick={() => setRange(7)}>7 days</button><button type="button" aria-pressed={range === 30} className={range === 30 ? "segment-active" : ""} onClick={() => setRange(30)}>30 days</button></div></div>
      {resource.loading ? <LoadingState /> : resource.error ? <ErrorState message={resource.error} onRetry={resource.refresh} /> : entries.length ? <div className="chart-wrap chart-wrap-tall"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
        <CartesianGrid vertical={false} stroke="#282d2a" strokeDasharray="4 5" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#858b86", fontSize: 11 }} interval={range === 7 ? 0 : 4} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#858b86", fontSize: 11 }} domain={["dataMin - 2", "dataMax + 2"]} /><Tooltip contentStyle={{ background: "#1b201d", border: "1px solid #343b35", borderRadius: 12, color: "#f3f5f0" }} formatter={(value) => [`${value} ${displayWeightUnit(user.unitSystem)}`, "Weight"]} /><Line type="monotone" dataKey="weight" connectNulls={false} stroke="#b6f36c" strokeWidth={2.5} dot={{ r: 4, fill: "#b6f36c", stroke: "#182016", strokeWidth: 2 }} activeDot={{ r: 6 }} />
      </LineChart></ResponsiveContainer></div> : <EmptyState icon={Scale} title="A starting point, whenever you're ready." description="Weigh-ins are optional. Add one to begin a personal trend." action={<AddButton onClick={() => setModal({ type: "edit", value: null })}>Log a weigh-in</AddButton>} />}
    </section>
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">YOUR HISTORY</span><h2>Weigh-ins</h2><p>Entries are private, and you can edit or remove them anytime.</p></div></div>
      {resource.loading ? <LoadingState /> : entries.length ? <div className="weight-history">{entries.map((entry) => <div className="weight-history-row" key={entry._id}><div className="weight-history-icon"><Scale size={16} /></div><div><strong>{fromKg(entry.weightKg, user.unitSystem)} {displayWeightUnit(user.unitSystem)}</strong><span>{entry.date.slice(0, 10)}{entry.notes ? ` · ${entry.notes}` : ""}</span></div><div className="record-actions"><button className="icon-button" aria-label="Edit weigh-in" onClick={() => setModal({ type: "edit", value: entry })}><Pencil size={14} /></button><button className="icon-button icon-danger" aria-label="Delete weigh-in" onClick={() => setDeleteItem(entry)}><Trash2 size={14} /></button></div></div>)}</div> : <p className="custom-food-empty">Your weigh-in history will appear here.</p>}
    </section>
    <div className="info-strip"><span>BMI is calculated only from valid height and latest weight. It is a limited screening measure and does not diagnose or fully assess health.</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {modal && <WeightForm initial={modal.value} units={user.unitSystem} onClose={() => setModal(null)} onSaved={() => { setModal(null); resource.refresh(); profileResource.refresh(); notify("Weigh-in saved."); }} />}
    {deleteItem && <ConfirmDelete title="Delete this weigh-in?" description="Your latest profile weight will update to the most recent remaining entry." onCancel={() => setDeleteItem(null)} onConfirm={remove} busy={busy} />}
  </div>;
}
