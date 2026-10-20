import { useEffect, useState } from "react";
import { Activity, Calculator, Info, Save, ShieldCheck } from "lucide-react";
import { useApp } from "../App.jsx";
import { api, fromCm, fromKg, toCm, toKg } from "../api.js";
import { Button, ErrorState, FormField, InlineNotice, LoadingState, PageHeading, useResource } from "../components.jsx";

function profileForm(profile) {
  const units = profile.unitSystem ?? "metric";
  return {
    name: profile.name ?? "",
    age: profile.age ?? "",
    sexForCalculation: profile.sexForCalculation ?? "",
    height: fromCm(profile.heightCm, units),
    weight: fromKg(profile.currentWeightKg, units),
    fitnessGoal: profile.fitnessGoal ?? "improve_fitness",
    activityLevel: profile.activityLevel ?? "moderate",
    unitSystem: units,
    calorieTargetOverride: profile.calorieTargetOverride ?? "",
  };
}

export default function Profile() {
  const { user, setUser } = useApp();
  const resource = useResource("/profile", []);
  const [form, setForm] = useState(() => profileForm(user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (resource.data?.profile) setForm(profileForm(resource.data.profile)); }, [resource.data]);
  const units = form.unitSystem;
  function changeUnits(nextUnits) {
    if (nextUnits === units) return;
    setForm((current) => ({
      ...current,
      unitSystem: nextUnits,
      height: current.height === "" ? "" : fromCm(toCm(current.height, current.unitSystem), nextUnits),
      weight: current.weight === "" ? "" : fromKg(toKg(current.weight, current.unitSystem), nextUnits),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const body = {
      name: form.name.trim(),
      age: form.age === "" ? null : Number(form.age),
      sexForCalculation: form.sexForCalculation || null,
      heightCm: form.height === "" ? null : toCm(form.height, units),
      currentWeightKg: form.weight === "" ? null : toKg(form.weight, units),
      fitnessGoal: form.fitnessGoal,
      activityLevel: form.activityLevel,
      unitSystem: units,
      calorieTargetOverride: form.calorieTargetOverride === "" ? null : Number(form.calorieTargetOverride),
    };
    try {
      const result = await api("/profile", { method: "PUT", body });
      setUser(result.profile);
      setForm(profileForm(result.profile));
      resource.setData(result);
      setSaved(true);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  if (resource.loading && !resource.data) return <div className="page-stack"><PageHeading eyebrow="YOUR DETAILS" title="Profile" description="Your information, your preferences." /><LoadingState label="Loading your profile…" /></div>;
  if (resource.error && !resource.data) return <div className="page-stack"><PageHeading eyebrow="YOUR DETAILS" title="Profile" description="Your information, your preferences." /><ErrorState message={resource.error} onRetry={resource.refresh} /></div>;

  const estimate = resource.data?.estimatedDailyCalories;
  return <div className="page-stack">
    <PageHeading eyebrow="YOUR DETAILS" title="Profile" description="Your information, your preferences. Change anything whenever you need." />
    <form className="profile-layout" onSubmit={submit}>
      <div className="profile-main-column">
        <section className="panel profile-panel">
          <div className="panel-heading"><div><span className="eyebrow">PERSONAL INFORMATION</span><h2>About you</h2><p>Used only to personalize your private dashboard and estimates.</p></div></div>
          <div className="form-stack">
            <div className="field-row"><FormField label="Name"><input autoComplete="name" minLength="2" maxLength="80" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField><FormField label="Email"><input type="email" disabled value={resource.data?.profile.email ?? user.email} /><span className="field-hint">Email cannot be changed in this version.</span></FormField></div>
            <div className="field-row-three"><FormField label="Age" hint="Age-sensitive estimates are only shown for adults 18–100."><input type="number" min="13" max="100" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} placeholder="Optional" /></FormField><FormField label="Height" hint={units === "imperial" ? "Enter total inches (for example, 67). Stored in cm." : "Stored in cm."}><input type="number" min={units === "imperial" ? "31.5" : "80"} max={units === "imperial" ? "98.4" : "250"} step="0.1" value={form.height} onChange={(event) => setForm({ ...form, height: event.target.value })} placeholder={units === "imperial" ? "in" : "cm"} /></FormField><FormField label={`Current weight (${units === "imperial" ? "lb" : "kg"})`} hint="Your latest weigh-in takes priority."><input type="number" min={units === "imperial" ? "55" : "25"} max={units === "imperial" ? "772" : "350"} step="0.1" value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} placeholder={units === "imperial" ? "lb" : "kg"} /></FormField></div>
            <FormField label="Sex used for calorie estimation" hint="This affects the Mifflin–St Jeor estimate only. You can leave it blank."><span className="select-wrap"><select value={form.sexForCalculation} onChange={(event) => setForm({ ...form, sexForCalculation: event.target.value })}><option value="">Not set</option><option value="female">Female coefficient</option><option value="male">Male coefficient</option></select></span></FormField>
          </div>
        </section>
        <section className="panel profile-panel">
          <div className="panel-heading"><div><span className="eyebrow">PREFERENCES</span><h2>Your settings</h2><p>Units apply consistently across workouts, progress, and targets.</p></div></div>
          <div className="form-stack">
            <div className="field-row"><FormField label="Preferred units"><span className="select-wrap"><select value={form.unitSystem} onChange={(event) => changeUnits(event.target.value)}><option value="metric">Metric (kg, cm, km)</option><option value="imperial">Imperial (lb, inches, miles)</option></select></span></FormField><FormField label="Fitness goal"><span className="select-wrap"><select value={form.fitnessGoal} onChange={(event) => setForm({ ...form, fitnessGoal: event.target.value })}><option value="lose_weight">Lose weight</option><option value="maintain">Maintain my routine</option><option value="gain_strength">Gain strength</option><option value="improve_fitness">Improve fitness</option></select></span></FormField></div>
            <FormField label="Activity level"><span className="select-wrap"><select value={form.activityLevel} onChange={(event) => setForm({ ...form, activityLevel: event.target.value })}><option value="sedentary">Sedentary — little structured exercise</option><option value="light">Light — 1–3 active days a week</option><option value="moderate">Moderate — 3–5 active days a week</option><option value="very_active">Very active — 6–7 active days a week</option></select></span></FormField>
          </div>
        </section>
        <section className="panel profile-panel">
          <div className="panel-heading"><div><span className="eyebrow">CALORIE TARGET</span><h2>Your daily target</h2><p>Use an estimate or set your own informational target.</p></div></div>
          <div className="calorie-estimate-row"><div className="estimate-icon"><Calculator size={19} /></div><div><strong>{estimate ? `${estimate.toLocaleString()} kcal/day estimated` : "Estimate not available"}</strong><span>{estimate ? "BMR × activity multiplier · informational, not medical advice." : "An adult age, valid height and weight, activity level and calculation coefficient are needed."}</span></div></div>
          <FormField label="Your daily target (kcal)" hint="Leave blank to use the estimate when available. This value is editable."><input type="number" min="500" max="10000" step="1" value={form.calorieTargetOverride} onChange={(event) => setForm({ ...form, calorieTargetOverride: event.target.value })} placeholder={estimate ? `Estimated ${estimate}` : "Optional"} /></FormField>
          <div className="medical-note"><Info size={16} /><span>Calorie estimates do not account for every individual difference and do not promise a health or weight outcome. FitBuddy is not medical advice.</span></div>
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
        {saved && <InlineNotice>Your profile has been saved.</InlineNotice>}
        <div className="profile-submit-row"><span><ShieldCheck size={15} />Your records are private to your account.</span><Button disabled={busy}><Save size={16} />{busy ? "Saving…" : "Save changes"}</Button></div>
      </div>
      <aside className="profile-side-column">
        <div className="panel estimate-method"><div className="estimate-icon"><Activity size={19} /></div><span className="eyebrow">HOW WE ESTIMATE</span><h3>One clear calculation.</h3><p>We use the Mifflin–St Jeor equation for estimated basal metabolic rate, then multiply by your activity level.</p><div className="formula-box">BMR = 10 × weight (kg) + 6.25 × height (cm) − 5 × age + coefficient</div><p className="estimate-coefficients">Coefficient: +5 for male or −161 for female. Activity multipliers range from 1.2 to 1.725.</p><div className="medical-note"><Info size={15} /><span>Adult estimates only (18–100). Not a diagnosis or personalized medical recommendation.</span></div></div>
        <div className="panel unit-note"><span className="eyebrow">YOUR DATA</span><h3>Stored consistently.</h3><p>Height and weight are stored in centimeters and kilograms, then displayed in the units you choose.</p><p>When you log weight, the latest dated entry updates your profile's current weight.</p></div>
      </aside>
    </form>
  </div>;
}
