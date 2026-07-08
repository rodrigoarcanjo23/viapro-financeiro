import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Cte {
  id: string;
  chave_acesso: string;
  numero_documento: string;
  cgf_emitente: string;
  razao_social_emitente: string;
  valor_total_servico: number;
  base_calculo_icms: number;
  icms_destacado: number;
  situacao: string;
}

export function ListaCte() {
  const [ctes, setCtes] = useState<Cte[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para Edição (Modal)
  const [editingCte, setEditingCte] = useState<Cte | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const buscarCtes = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('cte').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setCtes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    buscarCtes();
    window.addEventListener('cteSalvo', buscarCtes);
    return () => window.removeEventListener('cteSalvo', buscarCtes);
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Atenção: Tem certeza que deseja excluir este CTE permanentemente?")) return;
    
    const { error } = await supabase.from('cte').delete().eq('id', id);
    if (error) alert(`Erro ao excluir: ${error.message}`);
    else setCtes(ctes.filter(cte => cte.id !== id));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCte) return;
    
    setEditLoading(true);
    const { error } = await supabase.from('cte').update({
      razao_social_emitente: editingCte.razao_social_emitente,
      chave_acesso: editingCte.chave_acesso,
      numero_documento: editingCte.numero_documento,
      cgf_emitente: editingCte.cgf_emitente,
      valor_total_servico: editingCte.valor_total_servico,
      base_calculo_icms: editingCte.base_calculo_icms,
      icms_destacado: editingCte.icms_destacado,
      situacao: editingCte.situacao
    }).eq('id', editingCte.id);

    if (error) {
      alert(`Erro ao atualizar: ${error.message}`);
    } else {
      setEditingCte(null);
      buscarCtes();
    }
    setEditLoading(false);
  };

  // Filtro de Busca Inteligente
  const ctesFiltrados = ctes.filter(cte => {
    const termo = searchTerm.toLowerCase();
    return (
      cte.razao_social_emitente.toLowerCase().includes(termo) ||
      cte.chave_acesso.includes(termo) ||
      cte.numero_documento.includes(termo)
    );
  });

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  // Estilização condicional para a Situação
  const getBadgeStyle = (situacao: string) => {
    if (situacao === 'Autorizado') return { backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' };
    if (situacao === 'Cancelado') return { backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' };
    return { backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' };
  };

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Histórico de Transportes (CTE)</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Buscar por transportadora, chave ou doc..." 
            className="search-bar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={buscarCtes} className="btn btn-primary">Atualizar</button>
        </div>
      </div>

      {error && <div className="status-msg status-error">Erro: {error}</div>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Buscando dados...</p>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Nº Doc.</th>
                <th>Transportadora (Emitente)</th>
                <th>Chave de Acesso</th>
                <th>Valor do Serviço</th>
                <th>ICMS Destacado</th>
                <th>Situação</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ctesFiltrados.length > 0 ? ctesFiltrados.map((cte) => (
                <tr key={cte.id}>
                  <td style={{ fontWeight: '600' }}>{cte.numero_documento}</td>
                  <td>
                    <strong style={{ color: 'var(--text-main)' }}>{cte.razao_social_emitente}</strong>
                    <br />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>CGF: {cte.cgf_emitente || 'N/A'}</span>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {cte.chave_acesso}
                  </td>
                  <td style={{ color: 'var(--viapro-green)', fontWeight: '700' }}>
                    {formatarMoeda(cte.valor_total_servico)}
                  </td>
                  <td>{formatarMoeda(cte.icms_destacado)}</td>
                  <td>
                    <span style={getBadgeStyle(cte.situacao)}>{cte.situacao}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingCte(cte)} className="btn btn-sm btn-warning">Editar</button>
                      <button onClick={() => handleDelete(cte.id)} className="btn btn-sm btn-danger">Excluir</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Nenhum CTE encontrado para esta busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Janela Modal de Edição */}
      {editingCte && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="card-header">
              <h2>Editar CTE ({editingCte.numero_documento})</h2>
              <button onClick={() => setEditingCte(null)} className="btn btn-danger" style={{ padding: '0.2rem 0.6rem' }}>X</button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="form-grid">
                <div className="form-column">
                  <div className="input-group">
                    <label>Razão Social do Emitente</label>
                    <input type="text" className="input-field" value={editingCte.razao_social_emitente} onChange={(e) => setEditingCte({...editingCte, razao_social_emitente: e.target.value})} required />
                  </div>
                  <div className="input-group">
                    <label>Chave de Acesso</label>
                    <input type="text" className="input-field" value={editingCte.chave_acesso} onChange={(e) => setEditingCte({...editingCte, chave_acesso: e.target.value})} required />
                  </div>
                  <div className="input-group">
                    <label>Nº Documento Fiscal</label>
                    <input type="text" className="input-field" value={editingCte.numero_documento} onChange={(e) => setEditingCte({...editingCte, numero_documento: e.target.value})} required />
                  </div>
                  <div className="input-group">
                    <label>CGF do Emitente</label>
                    <input type="text" className="input-field" value={editingCte.cgf_emitente} onChange={(e) => setEditingCte({...editingCte, cgf_emitente: e.target.value})} />
                  </div>
                </div>
                <div className="form-column">
                  <div className="input-group">
                    <label>Valor Total do Serviço (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editingCte.valor_total_servico} onChange={(e) => setEditingCte({...editingCte, valor_total_servico: parseFloat(e.target.value)})} required />
                  </div>
                  <div className="input-group">
                    <label>Base de Cálculo ICMS (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editingCte.base_calculo_icms} onChange={(e) => setEditingCte({...editingCte, base_calculo_icms: parseFloat(e.target.value)})} />
                  </div>
                  <div className="input-group">
                    <label>ICMS Destacado (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editingCte.icms_destacado} onChange={(e) => setEditingCte({...editingCte, icms_destacado: parseFloat(e.target.value)})} />
                  </div>
                  <div className="input-group">
                    <label>Situação do Documento</label>
                    <select className="input-field" value={editingCte.situacao} onChange={(e) => setEditingCte({...editingCte, situacao: e.target.value})} required>
                      <option value="Autorizado">Autorizado</option>
                      <option value="Cancelado">Cancelado</option>
                      <option value="Recusado">Recusado</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setEditingCte(null)} className="btn btn-logout">Cancelar</button>
                <button type="submit" disabled={editLoading} className="btn btn-primary">{editLoading ? 'Salvando...' : 'Salvar Alterações'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}