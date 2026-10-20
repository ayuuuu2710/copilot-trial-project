import { useId, useState } from "react";
import { Download, ExternalLink, Moon, ShieldCheck, Sun, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, notify } from "../api.js";
import { useApp } from "../App.jsx";
import { Button, Modal, PageHeading } from "../components.jsx";

function PasswordControl({ label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  return <div className="field"><label className="field-label" htmlFor={inputId}>{label}</label><span className="password-field-control"><input id={inputId} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength="10" maxLength="128" value={value} onChange={onChange} /><button type="button" className="password-toggle" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "Hide" : "Show"}</button></span></div>;
}

function strengthLabel(value) {
  if (!value) return "";
  const score = [
    value.length >= 10,
    /[a-z]/.test(value) && /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
  return ["Add length and variety", "Could be stronger", "Good", "Strong", "Very strong"][score];
}

export default function Settings() {
  const { user, setUser, theme, setTheme, setAuthNotice } = useApp();
  const navigate = useNavigate();
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError("");
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError("Your new passwords do not match.");
      return;
    }
    if (passwords.currentPassword === passwords.newPassword) {
      setPasswordError("Choose a new password different from your current one.");
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await api("/auth/change-password", {
        method: "POST",
        body: { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword },
      });
      setUser(result.user);
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      notify("Password changed. Other active sessions were signed out.");
    } catch (error) {
      setPasswordError(error.message);
    } finally {
      setPasswordBusy(false);
    }
  }

  async function exportData() {
    setExportBusy(true);
    try {
      const data = await api("/account/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fitbuddy-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Your data export was downloaded.");
    } catch (error) {
      notify(error.message || "We couldn't export your data.");
    } finally {
      setExportBusy(false);
    }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    setDeleteError("");
    setDeleteBusy(true);
    try {
      await api("/account", { method: "DELETE", body: { password: deletePassword } });
      setDeleteOpen(false);
      setUser(null);
      setAuthNotice("Your account and its data were deleted.");
      navigate("/login", { replace: true });
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  return <div className="page-stack">
    <PageHeading eyebrow="MAKE IT YOURS" title="Settings" description="Appearance, account security, and control of your data." />

    <section className="panel settings-panel">
      <div className="panel-heading"><div><span className="eyebrow">APPEARANCE</span><h2>Theme</h2><p>Choose a theme or follow your device preference.</p></div><div className="settings-panel-icon"><Moon size={18} /></div></div>
      <div className="theme-options" role="group" aria-label="Color theme">
        {[["system", "System", "Follow device"], ["light", "Light", "Bright"], ["dark", "Dark", "Low light"]].map(([value, label, description]) => <button type="button" key={value} className={`theme-option${theme === value ? " theme-option-selected" : ""}`} aria-pressed={theme === value} onClick={() => setTheme(value)}><span className="theme-option-icon">{value === "light" ? <Sun size={18} /> : <Moon size={18} />}</span><span><strong>{label}</strong><small>{description}</small></span></button>)}
      </div>
      <p className="settings-note">Your selection is stored in this browser. The system option updates when your device theme changes.</p>
      <p className="settings-note"><ShieldCheck size={15} /> Reduced motion follows your device accessibility preference.</p>
    </section>

    <section className="panel settings-panel">
      <div className="panel-heading"><div><span className="eyebrow">UNITS</span><h2>Measurement units</h2><p>Use one consistent preference across your fitness records.</p></div></div>
      <p className="settings-copy">Your account is set to <strong>{user.unitSystem === "imperial" ? "Imperial (lb, inches, miles)" : "Metric (kg, cm, km)"}</strong>.</p>
      <Button variant="secondary" onClick={() => navigate("/profile")}>Manage units in Profile</Button>
    </section>

    <section className="panel settings-panel">
      <div className="panel-heading"><div><span className="eyebrow">PRIVACY & SECURITY</span><h2>Change password</h2><p>Changing your password signs out other active sessions.</p></div><div className="settings-panel-icon"><ShieldCheck size={18} /></div></div>
      <form className="settings-form" onSubmit={changePassword}>
        <PasswordControl label="Current password" autoComplete="current-password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} />
        <PasswordControl label="New password" autoComplete="new-password" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} />
        {passwords.newPassword && <p className="field-hint password-strength-text" aria-live="polite">Password strength: {strengthLabel(passwords.newPassword)}</p>}
        <PasswordControl label="Confirm new password" autoComplete="new-password" value={passwords.confirmPassword} onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} />
        {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
        <div className="settings-action-row"><span className="settings-note">Use at least 10 characters.</span><Button type="submit" disabled={passwordBusy}>{passwordBusy ? "Updating…" : "Change password"}</Button></div>
      </form>
    </section>

    <section className="panel settings-panel">
      <div className="panel-heading"><div><span className="eyebrow">YOUR DATA</span><h2>Export or delete</h2><p>Exports include your profile and saved fitness records, never your password or session data.</p></div><div className="settings-panel-icon"><Download size={18} /></div></div>
      <div className="settings-action-row settings-data-actions"><Button variant="secondary" onClick={exportData} disabled={exportBusy}><Download size={16} />{exportBusy ? "Preparing export…" : "Download my data"}</Button><Button variant="danger" onClick={() => setDeleteOpen(true)}><Trash2 size={16} />Delete account</Button></div>
      <p className="settings-note">Health records are stored by the configured FitBuddy server. Theme preference is stored only in this browser.</p>
    </section>

    <section className="panel settings-panel">
      <div className="panel-heading"><div><span className="eyebrow">AVAILABILITY</span><h2>Notifications and recovery</h2><p>FitBuddy will not claim to deliver features that are not configured.</p></div></div>
      <div className="settings-limitation"><strong>Notifications are unavailable.</strong><span>No notification delivery or scheduling service is configured.</span></div>
      <div className="settings-limitation"><strong>Password recovery is unavailable.</strong><span>Secure recovery requires a configured email delivery service. While signed in, you can change your password above.</span></div>
    </section>

    <section className="panel settings-panel settings-help">
      <div className="panel-heading"><div><span className="eyebrow">HELP & ABOUT</span><h2>FitBuddy</h2><p>Version 1.0.0 · private manual fitness tracking.</p></div></div>
      <details><summary>What does FitBuddy store?</summary><p>Workout, nutrition, weight, goal, and profile data is stored in your authenticated account on the configured MongoDB-backed server. The app does not provide offline synchronization.</p></details>
      <a className="settings-help-link" href="https://github.com/ayuuuu2710/copilot-trial-project" target="_blank" rel="noreferrer">Project help and setup <ExternalLink size={14} /></a>
    </section>

    {deleteOpen && <Modal title="Delete your account?" subtitle="This permanently removes your profile and all FitBuddy records. This cannot be undone." onClose={() => { if (!deleteBusy) setDeleteOpen(false); }}>
      <form className="form-stack" onSubmit={deleteAccount}>
        <PasswordControl label="Confirm with your password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        <div className="modal-actions"><Button variant="ghost" type="button" disabled={deleteBusy} onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" type="submit" disabled={deleteBusy}>{deleteBusy ? "Deleting account…" : "Permanently delete"}</Button></div>
      </form>
    </Modal>}
  </div>;
}
