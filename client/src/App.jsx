import { createContext, lazy, Suspense, useContext, useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, ArrowRight, BarChart3, ChefHat, ChevronDown, CircleUserRound, Dumbbell,
  Eye, EyeOff, Goal, HeartPulse, Home, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  Settings, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { api, notify } from "./api.js";
import { LoadingState } from "./components.jsx";

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Workouts = lazy(() => import("./pages/Workouts.jsx"));
const Nutrition = lazy(() => import("./pages/Nutrition.jsx"));
const Progress = lazy(() => import("./pages/Progress.jsx"));
const Goals = lazy(() => import("./pages/Goals.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const SettingsPage = lazy(() => import("./pages/Settings.jsx"));

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

function resolveSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function useThemePreference() {
  const [theme, setTheme] = useState(() => {
    const saved = window.localStorage.getItem("fitbuddy-theme");
    return ["dark", "light", "system"].includes(saved) ? saved : "system";
  });
  const [systemTheme, setSystemTheme] = useState(resolveSystemTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setSystemTheme(media.matches ? "light" : "dark");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === "system" ? systemTheme : theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "system" ? (systemTheme === "light" ? "#f4f7f1" : "#101311") : (theme === "light" ? "#f4f7f1" : "#101311"));
    window.localStorage.setItem("fitbuddy-theme", theme);
  }, [theme, systemTheme]);

  return [theme, setTheme];
}

const navigation = [
  { to: "/", label: "Overview", icon: Home, end: true },
  { to: "/workouts", label: "Workouts", icon: Dumbbell },
  { to: "/nutrition", label: "Nutrition", icon: ChefHat },
  { to: "/progress", label: "Progress", icon: BarChart3 },
  { to: "/goals", label: "My goals", icon: Goal },
  { to: "/settings", label: "Settings", icon: Settings },
];

function PasswordInput({ label, value, onChange, autoComplete, minLength, maxLength = 128, hint }) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  return <div className="field">
    <label className="field-label" htmlFor={inputId}>{label}</label>
    <span className="password-field-control">
      <input id={inputId} autoComplete={autoComplete} type={visible ? "text" : "password"} required minLength={minLength} maxLength={maxLength} value={value} onChange={onChange} />
      <button type="button" className="password-toggle" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
    </span>
    {hint && <span className="field-hint">{hint}</span>}
  </div>;
}

function PasswordStrength({ value }) {
  if (!value) return null;
  const checks = [value.length >= 10, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)];
  const score = checks.filter(Boolean).length;
  const label = ["Add length and variety", "Could be stronger", "Good", "Strong", "Very strong"][score];
  return <div className="password-strength" aria-live="polite">
    <div className="password-strength-bars" aria-hidden="true">{checks.map((_, index) => <span className={index < score ? `strength-level-${score}` : ""} key={index} />)}</div>
    <span>Password strength: {label}</span>
  </div>;
}

function AuthScreen({ onAuthenticated, initialMode = "login", notice = "" }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  async function submit(event) {
    event.preventDefault();
    if (isRegister && form.password !== form.confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { confirmPassword, ...body } = form;
      const result = await api(`/auth/${mode}`, { method: "POST", body });
      onAuthenticated(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <Link className="brand auth-brand" to="/"><span className="brand-mark"><Activity size={19} /></span><span className="brand-word">FitBuddy</span><span className="brand-dot">.</span></Link>
      <section className="auth-card">
        <div className="auth-symbol"><HeartPulse size={24} /></div>
        <span className="eyebrow">YOUR PERSONAL HEALTH SPACE</span>
        <h1>{isRegister ? "Start feeling stronger." : "Welcome back."}</h1>
        <p className="muted">{isRegister ? "A little progress, every day. Your journey starts here." : "Your progress is waiting right where you left it."}</p>
        {notice && <p className="inline-notice notice-success" role="status">{notice}</p>}
        <form onSubmit={submit} className="form-stack">
          {isRegister && <Field label="Your name"><input autoComplete="name" required minLength="2" maxLength="80" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Alex Morgan" /></Field>}
          <Field label="Email address"><input autoComplete="email" type="email" required maxLength="254" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></Field>
          <PasswordInput label="Password" hint={isRegister ? "At least 10 characters." : ""} autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 10 : 1} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          {isRegister && <><PasswordStrength value={form.password} /><PasswordInput label="Confirm password" autoComplete="new-password" minLength={10} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary button-full" disabled={busy}>{busy ? "Please wait…" : isRegister ? "Create your account" : "Sign in"}<ArrowRight size={17} /></button>
        </form>
        <div className="auth-switch">{isRegister ? "Already have an account?" : "New to FitBuddy?"}<button onClick={() => { setMode(isRegister ? "login" : "register"); setError(""); }}>{isRegister ? "Sign in" : "Create an account"}</button></div>
        <div className="auth-privacy"><ShieldCheck size={15} />Your health data is private to you</div>
      </section>
      <p className="auth-footnote">A calm place to build healthy habits.</p>
    </main>
  );
}

function Field({ label, hint, children }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}
export { Field };

function AppShell({ user, onLogout, sidebarCollapsed, setSidebarCollapsed }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const toastTimer = useRef(null);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    setMenuOpen(false);
    setProfileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function dismissProfileMenu(event) {
      if (event.key === "Escape") setProfileMenuOpen(false);
      if (event.type === "pointerdown" && !profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
    }
    document.addEventListener("keydown", dismissProfileMenu);
    document.addEventListener("pointerdown", dismissProfileMenu);
    return () => {
      document.removeEventListener("keydown", dismissProfileMenu);
      document.removeEventListener("pointerdown", dismissProfileMenu);
    };
  }, []);

  useEffect(() => {
    function showToast(event) {
      setToast({ ...event.detail, id: Date.now() });
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 5000);
    }
    window.addEventListener("fitbuddy:toast", showToast);
    return () => {
      window.removeEventListener("fitbuddy:toast", showToast);
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  async function logout() {
    setBusy(true);
    try {
      await onLogout();
      navigate("/login");
    } catch (error) {
      notify(error.message || "We couldn't sign you out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className={`app-layout${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand-row">
          <Link className="brand" to="/"><span className="brand-mark"><Activity size={19} /></span><span className="brand-word">FitBuddy</span><span className="brand-dot">.</span></Link>
          <button className="icon-button desktop-sidebar-toggle" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
          <button className="icon-button mobile-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} title={label} aria-label={label} className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}><Icon size={18} strokeWidth={1.9} /><span>{label}</span>{label === "My goals" && <span className="nav-live-dot" />}</NavLink>)}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip"><div className="tip-icon"><Sparkles size={16} /></div><strong>Small steps count.</strong><span>Consistency beats perfection. Keep showing up for you.</span></div>
        <NavLink to="/profile" className={({ isActive }) => `profile-mini${isActive ? " profile-mini-active" : ""}`}><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span className="profile-mini-copy"><strong>{user.name}</strong><small>Personal account</small></span><CircleUserRound size={17} className="profile-mini-icon" /></NavLink>
        <button className="logout-button" onClick={logout} disabled={busy}><LogOut size={16} />{busy ? "Signing out…" : "Sign out"}</button>
      </aside>
      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><span className="topbar-crumb">Your personal dashboard</span></div>
          <div className="topbar-right"><span className="status-pill"><span />Your data is private</span><div className="profile-menu-wrap" ref={profileMenuRef}><button className="profile-menu-trigger" aria-label="Open account menu" aria-expanded={profileMenuOpen} aria-controls="profile-menu" onClick={() => setProfileMenuOpen(!profileMenuOpen)}><span className="topbar-avatar">{user.name.slice(0, 1).toUpperCase()}</span><ChevronDown size={14} /></button>{profileMenuOpen && <div className="profile-menu" id="profile-menu" role="group" aria-label="Account menu"><div className="profile-menu-heading"><strong>{user.name}</strong><small>{user.email}</small></div><Link to="/profile"><CircleUserRound size={16} />Profile</Link><Link to="/settings"><Settings size={16} />Settings</Link><button onClick={logout} disabled={busy}><LogOut size={16} />{busy ? "Signing out…" : "Sign out"}</button></div>}</div></div>
        </header>
        <div className="page-content"><Suspense fallback={<LoadingState />}><Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></Suspense></div>
        <footer className="app-footer"><span>Made for your real life, not just your best days.</span><span>FitBuddy <span className="brand-dot">·</span> Your data stays yours</span></footer>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 4).map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? "mobile-nav-link mobile-nav-active" : "mobile-nav-link"}><Icon size={18} /><span>{label === "Overview" ? "Home" : label}</span></NavLink>)}
        <button className="mobile-nav-link" onClick={() => setMenuOpen(true)}><Menu size={18} /><span>More</span></button>
      </nav>
      {toast && <div className="toast" role="status" key={toast.id}><span>{toast.message}</span>{toast.action && <button onClick={() => { toast.action.onClick(); setToast(null); }}>{toast.action.label}</button>}<button className="toast-dismiss" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></div>}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState("");
  const [theme, setTheme] = useThemePreference();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem("fitbuddy-sidebar-collapsed") === "true");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api("/auth/me").then(({ user: currentUser }) => setUser(currentUser)).catch((error) => {
      setUser(null);
      if (error.status === 401 && /session has expired/i.test(error.message)) {
        setAuthNotice("Your session expired. Sign in again to continue.");
      }
    }).finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("fitbuddy-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    function expireSession() {
      setUser(null);
      setAuthNotice("Your session expired. Sign in again to continue.");
      navigate("/login", { replace: true });
    }
    window.addEventListener("fitbuddy:session-expired", expireSession);
    return () => window.removeEventListener("fitbuddy:session-expired", expireSession);
  }, [navigate]);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
    setAuthNotice("You have been signed out.");
  }

  if (authLoading) return <div className="loading-screen"><div className="loading-logo"><Activity size={20} /></div><span>Getting your space ready…</span></div>;
  if (!user) return location.pathname === "/register" ? <AuthScreen key="register" initialMode="register" onAuthenticated={setUser} notice={authNotice} /> : <AuthScreen key="login" onAuthenticated={setUser} notice={authNotice} />;

  return <AppContext.Provider value={{ user, setUser, theme, setTheme, setAuthNotice }}><AppShell user={user} onLogout={logout} sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} /></AppContext.Provider>;
}
