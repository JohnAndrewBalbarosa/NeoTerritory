import React from 'react';
import { useAuth } from '../../hooks/useAuth';

/**
 * LoginOverlay — stub component for the React migration.
 * Replaces the vanilla JS login-overlay DOM structure in the old index.html.
 * Full implementation (tester account list, form validation, error display)
 * will be added in a subsequent migration phase.
 */
export default function LoginOverlay() {
  const { signIn } = useAuth();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-overlay">
      <div className="login-wrap">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Sign in</h2>
          <p className="login-hint">Default tester password: <code>devcon</code></p>
          <label className="field">
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
          <button className="primary-btn" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p className="login-error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
