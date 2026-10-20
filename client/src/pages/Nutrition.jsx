import { useEffect, useMemo, useState } from "react";
import { Apple, Copy, Flame, Pencil, Plus, Search, Trash2, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, localDate, notify } from "../api.js";
import { AddButton, Button, ConfirmDelete, DateStepper, EmptyState, ErrorState, FormField, LoadingState, Modal, PageHeading, useResource } from "../components.jsx";

function FoodLogForm({ initial, date, onClose, onSaved }) {
  const isEditing = Boolean(initial?._id);
  const [form, setForm] = useState({
    foodId: initial?.foodId ?? "",
    date: initial?.date?.slice(0, 10) ?? date,
    meal: initial?.meal ?? "breakfast",
    quantityGrams: initial?.quantityGrams ?? 100,
  });
  const [search, setSearch] = useState(initial?.foodName ?? "");
  const [foods, setFoods] = useState([]);
  const [selected, setSelected] = useState(initial ? {
    id: initial.foodId, name: initial.foodName, calories: initial.nutrientsPer100g.calories,
    protein: initial.nutrientsPer100g.protein, carbohydrates: initial.nutrientsPer100g.carbohydrates,
    fat: initial.nutrientsPer100g.fat,
  } : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      api(`/foods?search=${encodeURIComponent(search)}`).then((result) => setFoods(result.foods)).catch((requestError) => setError(requestError.message));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function submit(event) {
    event.preventDefault();
    if (!form.foodId) { setError("Choose a food before saving this log."); return; }
    setBusy(true);
    setError("");
    try {
      const body = initial?.restoreSnapshot ? {
        ...form,
        foodName: selected.name,
        nutrientsPer100g: {
          calories: selected.calories,
          protein: selected.protein,
          carbohydrates: selected.carbohydrates,
          fat: selected.fat,
        },
      } : form;
      if (initial?._id) await api(`/food-logs/${initial._id}`, { method: "PUT", body });
      else await api(initial?.restoreSnapshot ? "/food-logs/restore" : "/food-logs", { method: "POST", body });
      notify(isEditing ? "Food log updated." : "Food added to your log.");
      onSaved();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  const quantity = Number(form.quantityGrams || 0) / 100;
  return <Modal title={isEditing ? "Edit food log" : "Log food"} subtitle="Nutrition values are approximate and scaled from 100 g." onClose={onClose} wide>
    <form className="form-stack" onSubmit={submit}>
      <FormField label="Find a food"><div className="input-with-icon"><Search size={16} /><input autoFocus value={search} onChange={(event) => { setSearch(event.target.value); setForm((value) => ({ ...value, foodId: "" })); setSelected(null); }} placeholder="Search 60+ foods or your custom foods" /></div></FormField>
      {search && foods.length > 0 && !selected && <div className="food-search-results" role="listbox" aria-label="Food search results">{foods.map((food) => <button className="food-result" type="button" key={food.id} role="option" aria-selected="false" onClick={() => { setSelected(food); setForm((value) => ({ ...value, foodId: food.id })); setSearch(food.name); }}><span className="food-result-icon"><Apple size={16} /></span><span><strong>{food.name}</strong><small>{food.sourceLabel}</small></span><span className="food-result-cal">{food.calories} <small>kcal / 100 g</small></span></button>)}</div>}
      {search && !foods.length && <div className="search-empty">No matching foods. Try another search or create a custom food.</div>}
      {selected && <div className="selected-food"><div><span className="food-result-icon"><Apple size={16} /></span><span><strong>{selected.name}</strong><small>{selected.sourceLabel ?? "Approximate values per 100 g"}</small></span></div><strong><Flame size={14} />{Math.round(selected.calories * quantity)} kcal</strong><button className="text-link" type="button" onClick={() => { setSelected(null); setForm((value) => ({ ...value, foodId: "" })); setSearch(""); }}>Change</button></div>}
      <div className="field-row-three"><FormField label="Date"><input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></FormField><FormField label="Meal"><span className="select-wrap"><select value={form.meal} onChange={(event) => setForm({ ...form, meal: event.target.value })}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></span></FormField><FormField label="Amount (grams)"><input type="number" min="1" max="10000" step="1" required value={form.quantityGrams} onChange={(event) => setForm({ ...form, quantityGrams: Number(event.target.value) })} /></FormField></div>
      {selected && <div className="nutrient-preview">{[["Calories", selected.calories * quantity, "kcal"], ["Protein", selected.protein * quantity, "g"], ["Carbs", selected.carbohydrates * quantity, "g"], ["Fat", selected.fat * quantity, "g"]].map(([label, value, unit]) => <div key={label}><span>{label}</span><strong>{Number(value).toFixed(label === "Calories" ? 0 : 1)}<small>{unit}</small></strong></div>)}</div>}
      <div className="custom-food-prompt"><span>Can't find it?</span><Button variant="ghost" type="button" className="button-small" onClick={() => { onClose(); window.dispatchEvent(new Event("fitbuddy:create-food")); }}><Plus size={14} />Create a custom food</Button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy || !selected}>{busy ? "Saving…" : isEditing ? "Save changes" : "Add to food log"}</Button></div>
    </form>
  </Modal>;
}

function CustomFoodForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(() => initial ? {
    name: initial.name,
    calories: initial.calories,
    protein: initial.protein,
    carbohydrates: initial.carbohydrates,
    fat: initial.fat,
  } : { name: "", calories: "", protein: "", carbohydrates: "", fat: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, key === "name" ? value : Number(value)]));
    try {
      if (initial?.id) await api(`/foods/custom/${initial.id}`, { method: "PUT", body });
      else await api("/foods/custom", { method: "POST", body });
      notify(initial?.id ? "Custom food updated." : "Custom food created.");
      onSaved();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  return <Modal title={initial ? "Edit custom food" : "Create a custom food"} subtitle="Enter approximate nutrition values for 100 g." onClose={onClose}>
    <form className="form-stack" onSubmit={submit}>
      <FormField label="Food name"><input required maxLength="100" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Homemade lentil soup" /></FormField>
      <div className="field-row-two"><FormField label="Calories (kcal)"><input required type="number" min="0" max="1000" step="0.1" value={form.calories} onChange={(event) => setForm({ ...form, calories: event.target.value })} /></FormField><FormField label="Protein (g)"><input required type="number" min="0" max="1000" step="0.1" value={form.protein} onChange={(event) => setForm({ ...form, protein: event.target.value })} /></FormField><FormField label="Carbohydrates (g)"><input required type="number" min="0" max="1000" step="0.1" value={form.carbohydrates} onChange={(event) => setForm({ ...form, carbohydrates: event.target.value })} /></FormField><FormField label="Fat (g)"><input required type="number" min="0" max="1000" step="0.1" value={form.fat} onChange={(event) => setForm({ ...form, fat: event.target.value })} /></FormField></div>
      <p className="form-disclaimer">Custom food values are saved privately. Existing logs keep their original nutrition snapshot if this food is later changed or removed.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : initial ? "Save food" : "Create food"}</Button></div>
    </form>
  </Modal>;
}

export default function Nutrition() {
  const navigate = useNavigate();
  const [date, setDate] = useState(localDate());
  const [modal, setModal] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteFood, setDeleteFood] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resource = useResource(`/food-logs?date=${date}`, [date]);
  const recentResource = useResource("/food-logs", []);
  const customResource = useResource("/foods/custom", []);
  const profileResource = useResource("/profile", []);
  const logs = resource.data?.foodLogs ?? [];
  const recentFoods = useMemo(() => {
    const seen = new Set();
    return (recentResource.data?.foodLogs ?? []).filter((log) => {
      if (seen.has(log.foodId)) return false;
      seen.add(log.foodId);
      return true;
    }).slice(0, 5);
  }, [recentResource.data]);
  const totals = logs.reduce((result, log) => {
    for (const key of ["calories", "protein", "carbohydrates", "fat"]) result[key] += log.nutrients[key];
    return result;
  }, { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });

  useEffect(() => {
    function createFood() { setModal({ type: "custom", value: null }); }
    window.addEventListener("fitbuddy:create-food", createFood);
    return () => window.removeEventListener("fitbuddy:create-food", createFood);
  }, []);

  async function removeLog() {
    setBusy(true);
    const removed = deleteItem;
    try {
      await api(`/food-logs/${removed._id}`, { method: "DELETE" });
      setDeleteItem(null);
      resource.refresh();
      recentResource.refresh();
      notify("Food log deleted.", { label: "Undo", onClick: async () => {
        try {
          await api("/food-logs/restore", { method: "POST", body: {
            foodId: removed.foodId,
            foodName: removed.foodName,
            date: removed.date.slice(0, 10),
            meal: removed.meal,
            quantityGrams: removed.quantityGrams,
            nutrientsPer100g: removed.nutrientsPer100g,
          } });
          resource.refresh();
          recentResource.refresh();
          notify("Food log restored.");
        } catch (restoreError) {
          notify(restoreError.message || "We couldn't restore that food log.");
        }
      } });
    }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  async function removeFood() {
    setBusy(true);
    try { await api(`/foods/custom/${deleteFood.id}`, { method: "DELETE" }); setDeleteFood(null); customResource.refresh(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  const meals = ["breakfast", "lunch", "dinner", "snack"];
  return <div className="page-stack">
    <PageHeading eyebrow="FUEL YOUR DAY" title="Nutrition" description="Eat well, track what matters, and keep it simple." action={<AddButton onClick={() => setModal({ type: "log", value: null })}>Log food</AddButton>} />
    <div className="nutrition-summary">
      <div className="nutrition-total"><div className="stat-icon stat-icon-orange"><Flame size={19} /></div><span>Calories logged</span><strong>{Math.round(totals.calories).toLocaleString()}<small> kcal</small></strong><span className="nutrition-summary-hint">Values are approximate, not lab-measured.</span></div>
      {[["Protein", totals.protein, "g", "macro-protein"], ["Carbohydrates", totals.carbohydrates, "g", "macro-carbs"], ["Fat", totals.fat, "g", "macro-fat"]].map(([name, value, unit, color]) => <div className="macro-summary" key={name}><span className={`macro-summary-dot ${color}`} /><span>{name}</span><strong>{Math.round(value)}<small> {unit}</small></strong></div>)}
      <DateStepper date={date} onChange={setDate} label="Nutrition" />
    </div>
    {profileResource.data?.effectiveDailyCalories > 0 && <section className="panel nutrition-target-panel">
      <div className="nutrition-target-copy"><div><span className="eyebrow">CALORIE PROGRESS</span><strong>{Math.round(totals.calories).toLocaleString()} / {profileResource.data.effectiveDailyCalories.toLocaleString()} kcal</strong></div><button className="text-link" type="button" onClick={() => navigate("/profile")}>Edit target</button></div>
      <div className="nutrition-target-track" role="progressbar" aria-label="Calories toward daily target" aria-valuemin="0" aria-valuemax={profileResource.data.effectiveDailyCalories} aria-valuenow={Math.min(totals.calories, profileResource.data.effectiveDailyCalories)}><span style={{ width: `${Math.min(100, totals.calories / profileResource.data.effectiveDailyCalories * 100)}%` }} /></div>
      <span className="field-hint">Informational estimate or target · macro totals below have no personal targets set.</span>
    </section>}
    {recentResource.error && <ErrorState message={recentResource.error} onRetry={recentResource.refresh} />}
    {!recentResource.loading && recentFoods.length > 0 && <section className="panel recent-foods-panel">    <div className="panel-heading"><div><span className="eyebrow">QUICK ADD</span><h2>Recent foods</h2><p>Start a log with a food you have used before.</p></div></div><div className="recent-food-chips">{recentFoods.map((food) => <button key={food.foodId} type="button" className="recent-food-chip" onClick={() => setModal({ type: "log", value: { ...food, _id: null, date, restoreSnapshot: true } })}><Plus size={14} /><span>{food.foodName}</span><small>{food.quantityGrams} g</small></button>)}</div></section>}
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">YOUR FOOD LOG</span><h2>Meals</h2><p>Nutrition scales with each amount you log.</p></div><AddButton variant="secondary" onClick={() => setModal({ type: "log", value: null })}>Add entry</AddButton></div>
      {resource.loading ? <LoadingState label="Loading your food log…" /> : resource.error ? <ErrorState message={resource.error} onRetry={resource.refresh} /> : logs.length === 0 ? <EmptyState icon={Utensils} title="Your food log is ready." description="Start with any meal—there's no need to get every detail perfect." action={<AddButton onClick={() => setModal({ type: "log", value: null })}>Log your first meal</AddButton>} /> : <div className="meal-groups">{meals.map((meal) => {
        const items = logs.filter((log) => log.meal === meal);
        if (!items.length) return null;
        return <div className="meal-group" key={meal}><div className="meal-heading"><div><span className={`meal-icon meal-${meal}`}><Utensils size={15} /></span><strong>{meal}</strong><span className="meal-count">{items.length}</span></div><span>{Math.round(items.reduce((sum, item) => sum + item.nutrients.calories, 0))} kcal</span></div>
          {items.map((log) => <div className="food-log-row" key={log._id}><div className="food-log-mark"><Apple size={17} /></div><div className="food-log-copy"><strong>{log.foodName}</strong><span>{log.quantityGrams} g <span>·</span> {Math.round(log.nutrients.calories)} kcal <span>·</span> {log.nutrients.protein} g protein</span></div><div className="food-log-actions"><button className="icon-button" aria-label={`Duplicate ${log.foodName} in this day`} title="Duplicate" onClick={() => setModal({ type: "log", value: { ...log, _id: null, date, restoreSnapshot: true } })}><Copy size={14} /></button><button className="icon-button" aria-label={`Edit ${log.foodName}`} onClick={() => setModal({ type: "log", value: log })}><Pencil size={14} /></button><button className="icon-button icon-danger" aria-label={`Delete ${log.foodName} log`} onClick={() => setDeleteItem(log)}><Trash2 size={14} /></button></div></div>)}
        </div>;
      })}</div>}
    </section>
    <section className="panel custom-food-panel">
      <div className="panel-heading"><div><span className="eyebrow">PERSONAL LIBRARY</span><h2>Your custom foods</h2><p>Private to your account · nutrition per 100 g</p></div><Button variant="secondary" onClick={() => setModal({ type: "custom", value: null })}><Plus size={16} />Create food</Button></div>
      {customResource.loading ? <LoadingState label="Loading custom foods…" /> : customResource.error ? <ErrorState message={customResource.error} onRetry={customResource.refresh} /> : customResource.data?.foods?.length ? <div className="custom-food-list">{customResource.data.foods.map((food) => <div className="custom-food-row" key={food.id}><span className="food-result-icon"><Apple size={15} /></span><div><strong>{food.name}</strong><span>{food.calories} kcal · {food.protein} g protein per 100 g</span></div><div className="record-actions"><button className="icon-button" aria-label={`Edit ${food.name}`} onClick={() => setModal({ type: "custom", value: food })}><Pencil size={14} /></button><button className="icon-button icon-danger" aria-label="Delete custom food" onClick={() => setDeleteFood(food)}><Trash2 size={14} /></button></div></div>)}</div> : <p className="custom-food-empty">Foods made by you appear here. Their nutrition values are yours to manage.</p>}
    </section>
    <div className="info-strip"><Flame size={16} /><span>Starter-food nutrition is approximate and illustrative per 100 g. Custom-food values use the information you enter.</span></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {modal?.type === "log" && <FoodLogForm initial={modal.value} date={date} onClose={() => setModal(null)} onSaved={() => { setModal(null); resource.refresh(); recentResource.refresh(); }} />}
    {modal?.type === "custom" && <CustomFoodForm initial={modal.value} onClose={() => setModal(null)} onSaved={() => { setModal(null); customResource.refresh(); }} />}
    {deleteItem && <ConfirmDelete title="Remove this food log?" description="This entry will be removed from your daily nutrition totals." onCancel={() => setDeleteItem(null)} onConfirm={removeLog} busy={busy} />}
    {deleteFood && <ConfirmDelete title={`Delete ${deleteFood.name}?`} description="Existing food logs keep a snapshot of this food's nutrition and will not change." onCancel={() => setDeleteFood(null)} onConfirm={removeFood} busy={busy} />}
  </div>;
}
