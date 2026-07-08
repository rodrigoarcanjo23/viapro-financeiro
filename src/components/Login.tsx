import { useState } from 'react';
import { supabase } from '../lib/supabase';
import logoViapro from '../assets/logo.png';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-body)', padding: '1rem' }}>
      <div className="premium-card" style={{ maxWidth: '420px', width: '100%', padding: '3rem 2.5rem', textAlign: 'center', margin: 0, boxShadow: 'var(--shadow-lg)' }}>
        
        <img src={logoViapro} alt="VIAPRO Logo" style={{ height: '120px', marginBottom: '2rem', objectFit: 'contain' }} />
        
        <h2 style={{ marginBottom: '2rem', color: 'var(--viapro-blue)', fontSize: '1.3rem' }}>
          Acesso Seguro ao Sistema
        </h2>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', textAlign: 'left' }}>
          <div className="input-group">
            <label>E-mail Institucional</label>
            <input 
              type="email" 
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label>Senha</label>
            <input 
              type="password" 
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="status-msg status-error" style={{ padding: '0.75rem', margin: 0 }}>{error}</div>}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '1rem', padding: '1rem', fontSize: '1.1rem' }}>
            {loading ? 'Autenticando...' : 'Entrar no Painel'}
          </button>
        </form>
      </div>
    </div>
  );
}