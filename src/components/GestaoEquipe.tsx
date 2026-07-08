import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';

interface Perfil {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  created_at: string;
}

export function GestaoEquipe() {
  const [equipe, setEquipe] = useState<Perfil[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  
  const [formData, setFormData] = useState({
    email: '',
    senha: '',
    nome: '',
    cargo: 'Assistente Financeiro'
  });
  
  const [loadingAction, setLoadingAction] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | null>(null);

  const buscarEquipe = async () => {
    setLoadingList(true);
    const { data, error } = await supabase.from('perfis').select('*').order('created_at', { ascending: true });
    if (!error && data) setEquipe(data);
    setLoadingList(false);
  };

  useEffect(() => {
    buscarEquipe();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCriarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction(true);
    setMessage('');

    // TRUQUE DE MESTRE: Instância secundária para não derrubar a sessão atual do Administrador
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const supabaseSecundario = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false } 
    });

    // 1. Cria a Autenticação (Senha)
    const { data: authData, error: authError } = await supabaseSecundario.auth.signUp({
      email: formData.email,
      password: formData.senha,
    });

    if (authError) {
      setMsgType('error');
      setMessage(`Erro ao criar acesso: ${authError.message}`);
      setLoadingAction(false);
      return;
    }

    // 2. Atualiza a tabela de perfis com o Nome e Cargo (o trigger já criou a linha base)
    if (authData.user) {
      await supabase.from('perfis').update({
        nome: formData.nome,
        cargo: formData.cargo
      }).eq('id', authData.user.id);
    }

    setMsgType('success');
    setMessage('Usuário criado e adicionado à equipe com sucesso!');
    setFormData({ email: '', senha: '', nome: '', cargo: 'Assistente Financeiro' });
    buscarEquipe();
    setLoadingAction(false);
  };

  const handleRemoverUsuario = async (id: string) => {
    if (!window.confirm("Atenção: Deseja remover este usuário permanentemente do sistema? Ele perderá o acesso instantaneamente.")) return;
    
    // Deletar da tabela perfis aciona o DELETE CASCADE e remove ele do auth.users se configurado,
    // mas no Supabase precisamos usar o painel Admin para deletar a Auth. 
    // Por enquanto, deletamos o perfil para ele perder visibilidade, mas o ideal é gerir a exclusão total pelo painel do Supabase.
    const { error } = await supabase.from('perfis').delete().eq('id', id);
    if (error) alert(`Erro: ${error.message}`);
    else buscarEquipe();
  };

  const getCargoBadge = (cargo: string) => {
    if (cargo === 'Gestor Financeiro' || cargo === 'Administrador') {
      return { backgroundColor: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' };
    }
    return { backgroundColor: '#f3f4f6', color: '#374151', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Formulário de Criação */}
      <div className="premium-card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <h2>Adicionar Novo Integrante</h2>
        </div>
        
        {message && (
          <div className={`status-msg ${msgType === 'error' ? 'status-error' : 'status-success'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleCriarUsuario}>
          <div className="form-grid">
            <div className="form-column">
              <div className="input-group">
                <label>Nome Completo</label>
                <input type="text" name="nome" className="input-field" value={formData.nome} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label>Cargo / Permissão</label>
                <select name="cargo" className="input-field" value={formData.cargo} onChange={handleChange} required>
                  <option value="Assistente Financeiro">Assistente Financeiro</option>
                  <option value="Contador">Contador</option>
                  <option value="Gestor Financeiro">Gestor Financeiro (Admin)</option>
                </select>
              </div>
            </div>
            <div className="form-column">
              <div className="input-group">
                <label>E-mail de Acesso</label>
                <input type="email" name="email" className="input-field" value={formData.email} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label>Senha Provisória (Mín. 6 caracteres)</label>
                <input type="password" name="senha" className="input-field" value={formData.senha} onChange={handleChange} minLength={6} required />
              </div>
            </div>
          </div>
          
          <hr style={{ borderColor: 'var(--border-color)', margin: '2rem 0 1.5rem', borderStyle: 'solid' }} />
          
          <button type="submit" disabled={loadingAction} className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
            {loadingAction ? 'Gerando Acesso...' : 'Registrar Novo Usuário'}
          </button>
        </form>
      </div>

      {/* Lista da Equipe */}
      <div className="premium-card">
        <div className="card-header">
          <h2>Membros da Equipe</h2>
          <button onClick={buscarEquipe} className="btn btn-primary btn-sm">Atualizar Lista</button>
        </div>

        {loadingList ? (
          <p style={{ color: 'var(--text-muted)' }}>Buscando integrantes...</p>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Nome do Funcionário</th>
                  <th>E-mail</th>
                  <th>Cargo / Função</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {equipe.map((membro) => (
                  <tr key={membro.id}>
                    <td style={{ fontWeight: '600' }}>{membro.nome || 'Pendente de atualização'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{membro.email}</td>
                    <td><span style={getCargoBadge(membro.cargo)}>{membro.cargo}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => handleRemoverUsuario(membro.id)} className="btn btn-sm btn-danger">Remover Acesso</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}