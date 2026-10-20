import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check, CircleDashed, Flag, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useApp } from "../App.jsx";
import { api, fromKg, localDate, notify, toKg } from "../api.js";
import { AddButton, Button, ConfirmDelete, EmptyState, ErrorState, FormField, LoadingState, Modal, PageHeading, useResource } from "../components.jsx";

const typeDefaults = {
  weight: { title: "Weight target", direction: "down", unit: "kg" },
  workouts: { title: "Weekly workouts", direction: "up", unit: "workouts" },
  calories: { title: "Daily calorie target", direction: "down", unit: "kcal" },
  custom: { title: "", direction: "up", unit: "" },
};

function GoalForm({ initial, user, onClose, onSaved }) {
  const isEditing = Boolean(initial?._id);
  const [form, setForm] = useState(() => {
    if (initial) return {
      title: initial.title,
      goalType: initial.goalType,
      targetValue: initial.goalType === "weight" ? fromKg(initial.targetValue, user.unitSystem) : initial.targetValue,
      startValue: initial.goalType === "weight" ? fromKg(initial.startValue, user.unitSystem) : initial.startValue,
      currentValue: initial.goalType === "weight" ? fromKg(initial.currentValue, user.unitSystem) : initial.currentValue,
      direction: initial.direction,
      unit: initial.unit,
      active: initial.active,
    };
    const startWeight = user.currentWeightKg ? fromKg(user.currentWeightKg, user.unitSystem) : "";
    return { title: "", goalType: "weight", targetValue: "", startValue: startWeight, currentValue: startWeight, direction: "down", unit: user.unitSystem === "imperial" ? "lb" : "kg", active: true };
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function changeType(goalType) {
    const defaults = typeDefaults[goalType];
    const targetUnit = goalType === "weight" ? (user.unitSystem === "imperial" ? "lb" : "kg") : defaults.unit;
    setForm((current) => ({
      ...current, goalType, title: defaults.title, direction: defaults.direction, unit: targetUnit,
      targetValue: "", startValue: goalType === "weight" && user.currentWeightKg ? fromKg(user.currentWeightKg, user.unitSystem) : 0,
      currentValue: 0,
    }));
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      ...form,
      targetValue: form.goalType === "weight" ? toKg(form.targetValue, user.unitSystem) : Number(form.targetValue),
      startValue: form.goalType === "weight" ? toKg(form.startValue, user.unitSystem) : Number(form.startValue),
      currentValue: form.goalType === "custom" ? Number(form.currentValue) : 0,
      unit: form.goalType === "weight" ? "kg" : form.unit,
    };
    try {
      if (isEditing) await api(`/goals/${initial._id}`, { method: "PUT", body });
      else await api("/goals", { method: "POST", body });
      onSaved();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  return <Modal title={isEditing ? "Edit your goal" : "Create a goal"} subtitle="Choose something measurable that matters to you." onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      <FormField label="Goal type"><span className="select-wrap"><select value={form.goalType} onChange={(event) => changeType(event.target.value)}><option value="weight">Weight target</option><option value="workouts">Workout frequency</option><option value="calories">Daily calories</option><option value="custom">Custom measurable goal</option></select></span></FormField>
      <FormField label="Goal name"><input required maxLength="100" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Give your goal a name" /></FormField>
      <div className="field-row">
        <FormField label="Target"><input type="number" required min="0" step="any" value={form.targetValue} onChange={(event) => setForm({ ...form, targetValue: event.target.value })} /></FormField>
        <FormField label="Direction"><span className="select-wrap"><select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value })}><option value="up">Build toward (higher)</option><option value="down">Move toward (lower)</option></select></span></FormField>
      </div>
      <div className="field-row">
        <FormField label="Starting point"><input type="number" required min="0" step="any" value={form.startValue} onChange={(event) => setForm({ ...form, startValue: event.target.value })} /></FormField>
        {form.goalType === "custom" ? <FormField label="Current value"><input type="number" min="0" step="any" value={form.currentValue} onChange={(event) => setForm({ ...form, currentValue: event.target.value })} /></FormField> : form.goalType === "weight" ? <FormField label="Unit"><input disabled value={user.unitSystem === "imperial" ? "lb (stored as kg)" : "kg"} /></FormField> : <FormField label="Unit"><input disabled value={form.unit} /></FormField>}
      </div>
      {form.goalType === "custom" && <FormField label="Progress unit"><input required maxLength="30" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="e.g. minutes, sessions, km" /></FormField>}
      <label className="checkbox-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span>Keep this goal active</span></label>
      <p className="form-disclaimer">{form.goalType === "weight" ? "Progress follows your latest weigh-in. Your starting value is the baseline; progress is capped at 100%." : form.goalType === "workouts" ? "Current value counts workouts from Monday through the selected dashboard day." : form.goalType === "calories" ? "Current value uses calories logged on the current dashboard day." : "Update your current value here; progress is capped at 100%."} An overshoot counts as complete.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose} disabled={busy}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : isEditing ? "Save goal" : "Create goal"}</Button></div>
    </form>
  </Modal>;
}

function GoalCard({ goal, units, onEdit, onDelete }) {
  const current = goal.currentValue ?? goal.startValue;
  const target = goal.targetValue;
  const shownCurrent = goal.goalType === "weight" ? fromKg(current, units) : Number(current).toFixed(goal.goalType === "custom" ? 1 : 0);
  const shownTarget = goal.goalType === "weight" ? fromKg(target, units) : Number(target).toFixed(goal.goalType === "custom" ? 1 : 0);
  const state = goal.complete || (!goal.active && goal.progress >= 100) ? "complete" : goal.active ? "active" : "paused";
  const Icon = goal.goalType === "weight" ? Target : goal.goalType === "workouts" ? ArrowUpRight : goal.goalType === "calories" ? ArrowDownRight : Flag;
  const suffix = goal.goalType === "weight" ? (units === "imperial" ? "lb" : "kg") : goal.unit;
  return <article className={`goal-card ${state === "complete" ? "goal-card-complete" : ""}`}>
    <div className="goal-card-top"><div className="goal-card-icon"><Icon size={19} /></div><span className={`goal-status goal-status-${state}`}>{state === "complete" ? <><Check size={13} />Complete</> : state === "active" ? <><CircleDashed size={13} />Active</> : "Paused"}</span></div>
    <h3>{goal.title}</h3><p className="goal-card-type">{goal.goalType === "custom" ? "Custom target" : `${goal.goalType[0].toUpperCase()}${goal.goalType.slice(1)} goal`}</p>
    <div className="goal-card-values"><div><span>Current</span><strong>{shownCurrent} <small>{suffix}</small></strong></div><span className="goal-value-arrow">→</span><div><span>Target</span><strong>{shownTarget} <small>{suffix}</small></strong></div><strong className="goal-card-percent">{goal.progress ?? 0}%</strong></div>
    <div className="progress-track"><div className={`progress-fill${state === "complete" ? " progress-complete" : ""}`} style={{ width: `${goal.progress ?? 0}%` }} /></div>
    <div className="goal-card-footer"><span>{state === "complete" ? "You made it. Well done." : `${Math.max(0, 100 - (goal.progress ?? 0))}% to go`}</span><div className="record-actions"><button className="icon-button" aria-label={`Edit ${goal.title}`} onClick={onEdit}><Pencil size={14} /></button><button className="icon-button icon-danger" aria-label={`Delete ${goal.title}`} onClick={onDelete}><Trash2 size={14} /></button></div></div>
  </article>;
}

export default function Goals() {
  const { user } = useApp();
  const [modal, setModal] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resource = useResource("/goals", []);
  const today = localDate();
  const dashboard = useResource(`/dashboard?date=${today}`, [today]);
  const progressMap = useMemo(() => new Map((dashboard.data?.goals ?? []).map((goal) => [goal._id, goal])), [dashboard.data]);
  const goals = (resource.data?.goals ?? []).map((goal) => ({ ...goal, ...(progressMap.get(goal._id) ?? {}) }));

  async function remove() {
    setBusy(true);
    try { await api(`/goals/${deleteItem._id}`, { method: "DELETE" }); setDeleteItem(null); resource.refresh(); dashboard.refresh(); notify("Goal deleted."); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  return <div className="page-stack">
    <PageHeading eyebrow="AIM FOR WHAT MATTERS" title="Your goals" description="Progress looks different for everyone. These goals are yours." action={<AddButton onClick={() => setModal({ type: "edit", value: null })}>Create a goal</AddButton>} />
    <div className="goal-rule-strip"><Target size={17} /><span>Track a weight target, weekly workouts, daily calories, or your own measurable milestone. Keep multiple goals active at once.</span></div>
    {resource.loading || dashboard.loading ? <LoadingState label="Loading your goals…" /> : resource.error ? <ErrorState message={resource.error} onRetry={resource.refresh} /> : dashboard.error ? <ErrorState message={dashboard.error} onRetry={dashboard.refresh} /> : goals.length ? <section className="goal-card-grid">{goals.map((goal) => <GoalCard key={goal._id} goal={goal} units={user.unitSystem} onEdit={() => setModal({ type: "edit", value: goal })} onDelete={() => setDeleteItem(goal)} />)}</section> : <div className="panel"><EmptyState icon={Flag} title="Your next milestone can start here." description="Choose a target that feels meaningful and achievable for you." action={<AddButton onClick={() => setModal({ type: "edit", value: null })}>Create your first goal</AddButton>} /></div>}
    <div className="info-strip"><span>Weight progress follows the latest valid weigh-in. Workout goals count sessions from Monday through today. Calorie goals use today's nutrition total. Custom goals are updated manually.</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {modal && <GoalForm initial={modal.value} user={user} onClose={() => setModal(null)} onSaved={() => { setModal(null); resource.refresh(); dashboard.refresh(); notify(modal.value ? "Goal updated." : "Goal created."); }} />}
    {deleteItem && <ConfirmDelete title="Delete this goal?" description="This goal and its progress history will be removed." onCancel={() => setDeleteItem(null)} onConfirm={remove} busy={busy} />}
  </div>;
}
