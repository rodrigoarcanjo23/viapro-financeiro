import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { NotaEntradaForm } from './components/NotaEntradaForm';
import { ListaNotasEntrada } from './components/ListaNotasEntrada';
import { NotaSaidaForm } from './components/NotaSaidaForm';
import { ListaNotasSaida } from './components/ListaNotasSaida';
import { CteForm } from './components/CteForm';
import { ListaCte } from './components/ListaCte';
import { FaturamentoForm } from './components/FaturamentoForm';
import { ListaFaturamento } from './components/ListaFaturamento';
import { ImpostoForm } from './components/ImpostoForm';
import { ListaImpostos } from './components/ListaImpostos';
import { GestaoEquipe } from './components/GestaoEquipe';
import { ListaAuditoria } from './components/ListaAuditoria'; // Nova importação
import type { Session } from '@supabase/supabase-js';
import logoViapro from './assets/logo.png';
import './App.css';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  // Adicionado o estado 'auditoria'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'entradas' | 'saidas' | 'cte' | 'faturamento' | 'impostos' | 'equipe' | 'auditoria'>('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!session) {
    return <Login />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <img src={logoViapro} alt="VIAPRO Logo" className="brand-logo" />
          <h1 className="header-title">Gestão Financeira</h1>
        </div>
        
        <div className="user-info">
          <span className="user-email">{session.user.email}</span>
          <button onClick={handleLogout} className="btn btn-logout">
            Sair do Sistema
          </button>
        </div>
      </header>
      
      <main>
        {/* Sistema de Abas */}
        <div className="tabs-container" style={{ flexWrap: 'wrap', gap: '0.5rem', display: 'flex' }}>
          <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            Visão Geral
          </button>
          <button className={`tab-btn ${activeTab === 'entradas' ? 'active' : ''}`} onClick={() => setActiveTab('entradas')}>
            Notas de Entrada
          </button>
          <button className={`tab-btn ${activeTab === 'saidas' ? 'active' : ''}`} onClick={() => setActiveTab('saidas')}>
            Notas de Saída
          </button>
          <button className={`tab-btn ${activeTab === 'cte' ? 'active' : ''}`} onClick={() => setActiveTab('cte')}>
            CTE (Transporte)
          </button>
          <button className={`tab-btn ${activeTab === 'faturamento' ? 'active' : ''}`} onClick={() => setActiveTab('faturamento')}>
            Faturamento
          </button>
          <button className={`tab-btn ${activeTab === 'impostos' ? 'active' : ''}`} onClick={() => setActiveTab('impostos')}>
            Impostos (DAS/Retenções)
          </button>
          
          {/* Menu Administrativo alinhado à direita */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button className={`tab-btn ${activeTab === 'auditoria' ? 'active' : ''}`} onClick={() => setActiveTab('auditoria')} style={{ borderBottom: '2px solid transparent' }}>
              🛡️ Auditoria
            </button>
            <button className={`tab-btn ${activeTab === 'equipe' ? 'active' : ''}`} onClick={() => setActiveTab('equipe')} style={{ borderBottom: '2px solid transparent' }}>
              ⚙️ Equipe e Acessos
            </button>
          </div>
        </div>

        {/* Renderização Condicional */}
        {activeTab === 'dashboard' && <Dashboard />}

        {activeTab === 'entradas' && (
          <><NotaEntradaForm /><ListaNotasEntrada /></>
        )}

        {activeTab === 'saidas' && (
          <><NotaSaidaForm /><ListaNotasSaida /></>
        )}

        {activeTab === 'cte' && (
          <><CteForm /><ListaCte /></>
        )}

        {activeTab === 'faturamento' && (
          <><FaturamentoForm /><ListaFaturamento /></>
        )}

        {activeTab === 'impostos' && (
          <><ImpostoForm /><ListaImpostos /></>
        )}

        {activeTab === 'auditoria' && <ListaAuditoria />}

        {activeTab === 'equipe' && <GestaoEquipe />}
      </main>
    </div>
  );
}

export default App;