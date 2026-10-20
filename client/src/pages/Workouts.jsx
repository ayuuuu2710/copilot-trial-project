import { useMemo, useState } from "react";
import { Activity, Clock3, Copy, Dumbbell, Footprints, Pencil, Trash2 } from "lucide-react";
import { useApp } from "../App.jsx";
import { api, displayDistanceUnit, displayWeightUnit, fromKg, fromKm, localDate, notify, toKg, toKm } from "../api.js";
import { AddButton, Button, ConfirmDelete, EmptyState, ErrorState, FormField, LoadingState, Modal, PageHeading, useResource } from "../components.jsx";

const blank = (kind = "strength", units = "metric") => ({
  kind, date: localDate(), exerciseName: "", activityType: "", sets: 3, repetitions: 10,
  resistanceKg: "", durationMinutes: 30, distanceKm: "", notes: "", units,
});

function WorkoutForm({ initial, units, onClose, onSaved }) {
  const isEditing = Boolean(initial?._id);
  const [form, setForm] = useState(initial ? {
    kind: initial.kind,
    date: initial.date?.slice(0, 10) ?? localDate(),
    exerciseName: initial.exerciseName ?? "",
    activityType: initial.activityType ?? "",
    sets: initial.sets ?? 3,
    repetitions: initial.repetitions ?? 10,
    resistanceKg: fromKg(initial.resistanceKg, units),
    durationMinutes: initial.durationMinutes ?? 30,
    distanceKm: fromKm(initial.distanceKm, units),
    notes: initial.notes ?? "",
    units,
  } : blank("strength", units));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = form.kind === "strength";
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = form.kind === "strength" ? {
      kind: "strength",
      date: form.date,
      exerciseName: form.exerciseName,
      sets: form.sets,
      repetitions: form.repetitions,
      ...(form.resistanceKg === "" ? {} : { resistanceKg: toKg(form.resistanceKg, units) }),
      notes: form.notes,
    } : {
      kind: "cardio",
      date: form.date,
      activityType: form.activityType,
      durationMinutes: form.durationMinutes,
      ...(form.distanceKm === "" ? {} : { distanceKm: toKm(form.distanceKm, units) }),
      notes: form.notes,
    };
    try {
      if (isEditing) await api(`/workouts/${initial._id}`, { method: "PUT", body });
      else await api("/workouts", { method: "POST", body });
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  function change(name, value) { setForm((current) => ({ ...current, [name]: value })); }
  return <Modal title={isEditing ? "Edit workout" : "Log a workout"} subtitle="Record the movement you made time for." onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      <div className="field-row"><FormField label="Workout type"><span className="select-wrap"><select value={form.kind} onChange={(event) => setForm(blank(event.target.value, units))}><option value="strength">Strength</option><option value="cardio">Cardio</option></select></span></FormField><FormField label="Date"><input type="date" required value={form.date} onChange={(event) => change("date", event.target.value)} /></FormField></div>
      {strength ? <>
        <FormField label="Exercise"><input required maxLength="100" value={form.exerciseName} onChange={(event) => change("exerciseName", event.target.value)} placeholder="e.g. Goblet squat" /></FormField>
        <div className="field-row-three"><FormField label="Sets"><input type="number" min="1" max="100" required value={form.sets} onChange={(event) => change("sets", Number(event.target.value))} /></FormField><FormField label="Reps"><input type="number" min="1" max="1000" required value={form.repetitions} onChange={(event) => change("repetitions", Number(event.target.value))} /></FormField><FormField label={`Load (${displayWeightUnit(units)})`}><input type="number" min="0" step="0.1" value={form.resistanceKg} onChange={(event) => change("resistanceKg", event.target.value)} placeholder="Optional" /></FormField></div>
      </> : <>
        <FormField label="Activity"><input required maxLength="100" value={form.activityType} onChange={(event) => change("activityType", event.target.value)} placeholder="e.g. Easy run" /></FormField>
        <div className="field-row"><FormField label="Duration (minutes)"><input type="number" min="1" max="1440" required value={form.durationMinutes} onChange={(event) => change("durationMinutes", Number(event.target.value))} /></FormField><FormField label={`Distance (${displayDistanceUnit(units)})`}><input type="number" min="0" step="0.1" value={form.distanceKm} onChange={(event) => change("distanceKm", event.target.value)} placeholder="Optional" /></FormField></div>
      </>}
      <FormField label="Notes" hint="Optional · visible only to you"><textarea rows="2" maxLength="500" value={form.notes} onChange={(event) => change("notes", event.target.value)} placeholder="How did it feel?" /></FormField>
      <p className="form-disclaimer">FitBuddy does not estimate calories burned.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : isEditing ? "Save changes" : "Save workout"}</Button></div>
    </form>
  </Modal>;
}

export default function Workouts() {
  const { user } = useApp();
  const [modal, setModal] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, loading, error: loadError, refresh } = useResource("/workouts", []);
  const workouts = data?.workouts ?? [];
  const grouped = useMemo(() => workouts.reduce((groups, workout) => {
    const date = workout.date.slice(0, 10);
    const key = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    groups[key] ??= [];
    groups[key].push(workout);
    return groups;
  }, {}), [workouts]);

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api(`/workouts/${deleteItem._id}`, { method: "DELETE" });
      setDeleteItem(null);
      refresh();
      notify("Workout deleted.");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return <div className="page-stack">
    <PageHeading eyebrow="MOVE YOUR WAY" title="Workouts" description="Every rep, every walk, every time you showed up." action={<AddButton onClick={() => setModal({ type: "edit", value: null })}>Log workout</AddButton>} />
    <div className="info-strip"><Activity size={16} /><span>Manual tracking only. We never estimate calories burned or judge your activity.</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <LoadingState label="Loading your workouts…" /> : loadError ? <ErrorState message={loadError} onRetry={refresh} /> : workouts.length === 0 ? <div className="panel"><EmptyState icon={Dumbbell} title="Your first workout goes here." description="Strength sessions and cardio both count. Log what feels right for you." action={<AddButton onClick={() => setModal({ type: "edit", value: null })}>Add your first workout</AddButton>} /></div> : <section className="workout-groups">{Object.entries(grouped).map(([date, records]) => <div key={date}><div className="date-group-label"><span>{date}</span><span>{records.length} {records.length === 1 ? "session" : "sessions"}</span></div><div className="record-list">{records.map((workout) => {
      const isStrength = workout.kind === "strength";
      return <article className="record-card" key={workout._id}>
        <div className={`record-icon ${isStrength ? "record-strength" : "record-cardio"}`}>{isStrength ? <Dumbbell size={20} /> : <Footprints size={20} />}</div>
        <div className="record-main"><div className="record-title-line"><h3>{isStrength ? workout.exerciseName : workout.activityType}</h3><span className={`kind-tag ${isStrength ? "tag-strength" : "tag-cardio"}`}>{isStrength ? "Strength" : "Cardio"}</span></div><p>{isStrength ? <>{workout.sets} sets <span>·</span> {workout.repetitions} reps{workout.resistanceKg ? <> <span>·</span> {fromKg(workout.resistanceKg, user.unitSystem)} {displayWeightUnit(user.unitSystem)}</> : null}</> : <>{workout.durationMinutes} min{workout.distanceKm ? <> <span>·</span> {fromKm(workout.distanceKm, user.unitSystem)} {displayDistanceUnit(user.unitSystem)}</> : null}</>}</p>{workout.notes && <small className="record-notes">{workout.notes}</small>}</div>
        {!isStrength && <span className="record-meta"><Clock3 size={14} />{workout.durationMinutes} min</span>}
        <div className="record-actions"><button className="icon-button" aria-label={`Duplicate ${isStrength ? workout.exerciseName : workout.activityType}`} title="Duplicate" onClick={() => setModal({ type: "edit", value: { ...workout, _id: null, date: localDate() } })}><Copy size={14} /></button><button className="icon-button" aria-label={`Edit ${isStrength ? workout.exerciseName : workout.activityType}`} onClick={() => setModal({ type: "edit", value: workout })}><Pencil size={15} /></button><button className="icon-button icon-danger" aria-label={`Delete ${isStrength ? workout.exerciseName : workout.activityType}`} onClick={() => setDeleteItem(workout)}><Trash2 size={15} /></button></div>
      </article>;
    })}</div></div>)}</section>}
    {modal && <WorkoutForm initial={modal.value} units={user.unitSystem} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); notify("Workout saved."); }} />}
    {deleteItem && <ConfirmDelete title="Delete this workout?" description="This workout will be permanently removed from your activity history." onCancel={() => setDeleteItem(null)} onConfirm={remove} busy={busy} />}
  </div>;
}
