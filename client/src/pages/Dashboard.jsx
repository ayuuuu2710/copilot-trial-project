import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChefHat, CircleHelp,
  Dumbbell, Flame, Footprints, Heart, Scale, Sparkles, Target, TrendingUp,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useApp } from "../App.jsx";
import { displayWeightUnit, localDate } from "../api.js";
import { DateStepper, ErrorState, LoadingState, PageHeading, useResource } from "../components.jsx";

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

function StatCard({ label, value, unit, icon: Icon, tone, footnote }) {
  return <article className="stat-card"><div className={`stat-icon stat-icon-${tone}`}><Icon size={19} /></div><span className="stat-label">{label}</span><div className="stat-value">{value}<small>{unit}</small></div><span className="stat-footnote">{footnote}</span></article>;
}

function GoalProgress({ goal }) {
  return <div className="goal-progress-row"><div className="goal-row-head"><div><span className="goal-type-dot" /><strong>{goal.title}</strong></div><span className="goal-percent">{goal.complete ? "Done" : `${goal.progress}%`}</span></div><div className="progress-track"><div className={`progress-fill${goal.complete ? " progress-complete" : ""}`} style={{ width: `${goal.progress}%` }} /></div><div className="goal-row-foot"><span>{Number(goal.currentValue).toFixed(1)} {goal.unit}</span><span>Target {Number(goal.targetValue).toFixed(1)} {goal.unit}</span></div></div>;
}

export default function Dashboard() {
  const { user } = useApp();
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [range, setRange] = useState(7);
  const resource = useResource(`/dashboard?date=${selectedDate}`, [selectedDate]);
  const data = resource.data;
  const displayWeights = useMemo(() => data?.trends?.[range === 7 ? "sevenDays" : "thirtyDays"].map((point) => ({
    ...point,
    displayWeight: point.weightKg == null ? null : Number((point.weightKg * (user.unitSystem === "imperial" ? 2.2046226218 : 1)).toFixed(1)),
    label: new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  })) ?? [], [data, range, user.unitSystem]);

  return <div className="page-stack">
    <PageHeading eyebrow="YOUR DAILY SNAPSHOT" title={`${greeting()}, ${user.name.split(" ")[0]}.`} description="A little progress goes a long way. Here's where you are today." action={<DateStepper date={selectedDate} onChange={setSelectedDate} label="Dashboard" />} />
    {resource.loading && !data ? <LoadingState /> : resource.error ? <ErrorState message={resource.error} onRetry={resource.refresh} /> : data && <>
      <section className="stat-grid">
        <StatCard label="Calories today" value={Math.round(data.nutrition.calories).toLocaleString()} unit="kcal" icon={Flame} tone="orange" footnote={data.calorieTarget.effective ? `${data.calorieTarget.progress}% of your daily target` : "Set a profile to estimate your target"} />
        <StatCard label="Workouts" value={data.activity.workoutCount} unit="sessions" icon={Dumbbell} tone="green" footnote={`${data.activity.durationMinutes} min logged today`} />
        <StatCard label="Protein" value={Math.round(data.nutrition.protein)} unit="g" icon={Heart} tone="pink" footnote={`${Math.round(data.nutrition.carbohydrates)} g carbs · ${Math.round(data.nutrition.fat)} g fat`} />
        <StatCard label="Current weight" value={data.latestWeightKg == null ? "—" : (data.latestWeightKg * (user.unitSystem === "imperial" ? 2.2046226218 : 1)).toFixed(1)} unit={displayWeightUnit(user.unitSystem)} icon={Scale} tone="blue" footnote={data.bmi == null ? "Log weight and height for BMI" : `BMI ${data.bmi} · a limited screening measure`} />
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading"><div><span className="eyebrow">YOUR TREND</span><h2>Weight progress</h2><p>Gentle progress, on your own timeline.</p></div><div className="segmented-control" role="group" aria-label="Trend range"><button type="button" aria-pressed={range === 7} className={range === 7 ? "segment-active" : ""} onClick={() => setRange(7)}>7 days</button><button type="button" aria-pressed={range === 30} className={range === 30 ? "segment-active" : ""} onClick={() => setRange(30)}>30 days</button></div></div>
          {displayWeights.some((point) => point.displayWeight != null) ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={displayWeights} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <defs><linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b6f36c" stopOpacity={0.2} /><stop offset="95%" stopColor="#b6f36c" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#282d2a" strokeDasharray="4 5" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#858b86", fontSize: 11 }} interval={range === 7 ? 0 : 4} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#858b86", fontSize: 11 }} domain={["dataMin - 2", "dataMax + 2"]} />
            <Tooltip contentStyle={{ background: "#1b201d", border: "1px solid #343b35", borderRadius: 12, color: "#f3f5f0" }} formatter={(value) => [`${value} ${displayWeightUnit(user.unitSystem)}`, "Weight"]} />
            <Area type="monotone" dataKey="displayWeight" connectNulls stroke="#b6f36c" strokeWidth={2.5} fill="url(#weightGradient)" activeDot={{ r: 5, fill: "#b6f36c", stroke: "#182016", strokeWidth: 3 }} />
          </AreaChart></ResponsiveContainer></div> : <div className="chart-empty"><div className="empty-icon"><TrendingUp size={20} /></div><span>Start with one entry.</span><p>Your weight trend will take shape here over time.</p><Link to="/progress" className="text-link">Log your first weigh-in <ArrowRight size={14} /></Link></div>}
          <div className="chart-caption"><span><span className="chart-legend-dot" />Weight logged</span><span>Missing days stay empty—no estimates</span></div>
        </article>

        <article className="panel calorie-panel">
          <div className="panel-heading"><div><span className="eyebrow">NUTRITION</span><h2>Daily fuel</h2></div><Link to="/nutrition" aria-label="Open nutrition" className="round-arrow"><ArrowRight size={16} /></Link></div>
          <div className="calorie-dial" role={data.calorieTarget.effective ? "progressbar" : undefined} aria-label={data.calorieTarget.effective ? "Calories toward daily target" : undefined} aria-valuemin={data.calorieTarget.effective ? 0 : undefined} aria-valuemax={data.calorieTarget.effective ? 100 : undefined} aria-valuenow={data.calorieTarget.effective ? data.calorieTarget.progress ?? 0 : undefined} aria-valuetext={data.calorieTarget.effective ? `${data.calorieTarget.progress}% of daily target` : undefined} style={{ "--dial-progress": `${data.calorieTarget.progress ?? 0}%` }}><div><Flame size={17} /><strong>{Math.round(data.nutrition.calories).toLocaleString()}</strong><span>kcal eaten</span></div></div>
          <div className="calorie-target-line"><span>Daily target</span><strong>{data.calorieTarget.effective ? `${data.calorieTarget.effective.toLocaleString()} kcal` : "Not set"}</strong></div>
          <p className="calorie-disclaimer">{data.calorieTarget.estimated ? "Your calorie target is an estimate, not medical advice." : "Add your age, height and activity in your profile to see an estimate."}</p>
          <div className="macro-list">
            {[["Protein", data.nutrition.protein, "g", "#b6f36c"], ["Carbs", data.nutrition.carbohydrates, "g", "#9db9ff"], ["Fat", data.nutrition.fat, "g", "#ffbd79"]].map(([label, value, unit, color]) => <div className="macro-row" key={label}><span className="macro-dot" style={{ background: color }} /><span>{label}</span><strong>{Math.round(value)} {unit}</strong></div>)}
          </div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid-lower">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">KEEP YOUR MOMENTUM</span><h2>Active goals</h2><p>Your goals, measured by what you do.</p></div><Link to="/goals" className="text-link">All goals <ArrowRight size={14} /></Link></div>
          {data.goals.length ? <div className="goal-progress-list">{data.goals.slice(0, 3).map((goal) => <GoalProgress key={goal._id} goal={goal} />)}</div> : <div className="compact-empty"><Target size={19} /><span>No active goals yet.</span><Link to="/goals" className="text-link">Create one <ArrowRight size={13} /></Link></div>}
        </article>
        <article className="panel activity-panel">
          <div className="panel-heading"><div><span className="eyebrow">TODAY'S ACTIVITY</span><h2>Showed up for you</h2></div><span className="activity-status"><span />{data.activity.workoutCount ? "Logged" : "Ready when you are"}</span></div>
          {data.workouts.length ? <div className="activity-list">{data.workouts.map((workout) => <div className="activity-item" key={workout._id}><span className={`activity-type-icon ${workout.kind}`} >{workout.kind === "strength" ? <Dumbbell size={17} /> : <Footprints size={17} />}</span><div className="activity-copy"><strong>{workout.kind === "strength" ? workout.exerciseName : workout.activityType}</strong><span>{workout.kind === "strength" ? `${workout.sets} sets × ${workout.repetitions} reps` : `${workout.durationMinutes} min${workout.distanceKm ? ` · ${workout.distanceKm} km` : ""}`}</span></div><Check size={16} className="activity-check" /></div>)}</div> : <div className="activity-empty"><div className="empty-icon"><Footprints size={20} /></div><strong>Every session starts somewhere.</strong><span>Add movement when you're ready.</span><Link className="button button-secondary button-small" to="/workouts"><Dumbbell size={15} />Log a workout</Link></div>}
        </article>
      </section>
    </>}
    <div className="dashboard-note"><CircleHelp size={15} /><span>Numbers are here to help you notice patterns—not define your progress.</span><Sparkles size={15} /></div>
  </div>;
}
