import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface NotaEntrada {
  id: string;
  cnpj: string;
  razao_social: string;
  chave_acesso: string;
  uf: string;
  data_emissao: string;
  data_entrada: string;
  numero_nfe: string;
  cfop: string;
  valor_nfe: number;
  protocolo?: string;
  situacao: string;
  observacao?: string;
  arquivo_url?: string;
}

export function ListaNotasEntrada() {
  const [notas, setNotas] = useState<NotaEntrada[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ESTADOS DE PAGINAÇÃO DE ALTA PERFORMANCE
  const [pagina, setPagina] = useState(0);
  const itensPorPagina = 5;
  const [temMais, setTemMais] = useState(true);

  const [editingNota, setEditingNota] = useState<NotaEntrada | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const buscarNotas = async () => {
    setLoading(true);
    setError(null);

    // Carregamento via Range (Paginação eficiente no banco)
    const { data, error } = await supabase
      .from('notas_entrada')
      .select('*')
      .order('created_at', { ascending: false })
      .range(pagina * itensPorPagina, (pagina + 1) * itensPorPagina - 1);

    if (error) {
      setError(error.message);
    } else {
      if (data.length < itensPorPagina) setTemMais(false);
      else setTemMais(true);
      setNotas(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    buscarNotas();
    window.addEventListener('notaEntradaSalva', buscarNotas);
    return () => window.removeEventListener('notaEntradaSalva', buscarNotas);
  }, [pagina]); // Atualiza quando muda de página

  const handleDelete = async (id: string, numero: string) => {
    if (!window.confirm(`Confirma a exclusão da NF-e nº ${numero}? Esta ação gravará um log de auditoria.`)) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('itens_nota_entrada').delete().eq('nota_entrada_id', id);
    const { error } = await supabase.from('notas_entrada').delete().eq('id', id);
    
    if (error) {
      alert(`Erro ao excluir: ${error.message}`);
    } else {
      // TRILHA DE AUDITORIA NA EXCLUSÃO
      await supabase.from('logs_auditoria').insert([{
        usuario: user?.email || 'Sistema',
        acao: 'Exclusão de Registro',
        tabela: 'notas_entrada',
        detalhes: `Usuário excluiu permanentemente a NF-e nº ${numero}`
      }]);
      buscarNotas();
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNota) return;
    setEditLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('notas_entrada').update({
      razao_social: editingNota.razao_social,
      chave_acesso: editingNota.chave_acesso,
      uf: editingNota.uf,
      data_emissao: editingNota.data_emissao,
      data_entrada: editingNota.data_entrada,
      numero_nfe: editingNota.numero_nfe,
      cfop: editingNota.cfop,
      valor_nfe: editingNota.valor_nfe,
      protocolo: editingNota.protocolo,
      situacao: editingNota.situacao,
      observacao: editingNota.observacao
    }).eq('id', editingNota.id);

    if (error) {
      alert(`Erro ao atualizar: ${error.message}`);
    } else {
      // TRILHA DE AUDITORIA NA EDIÇÃO
      await supabase.from('logs_auditoria').insert([{
        usuario: user?.email || 'Sistema',
        acao: 'Edição de Registro',
        tabela: 'notas_entrada',
        registro_id: editingNota.id,
        detalhes: `Modificação nos dados cadastrais da NF-e nº ${editingNota.numero_nfe}`
      }]);
      setEditingNota(null);
      buscarNotas();
    }
    setEditLoading(false);
  };

  const notasFiltradas = notas.filter(nota => {
    const termo = searchTerm.toLowerCase();
    return (
      nota.razao_social.toLowerCase().includes(termo) ||
      nota.cnpj.includes(termo) ||
      nota.numero_nfe.includes(termo)
    );
  });

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Histórico de Notas de Entrada</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Buscar por fornecedor, CNPJ..." 
            className="search-bar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="status-msg status-error">Erro: {error}</div>}

      {loading && notas.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Buscando dados paginados...</p>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Nº NF-e</th>
                <th>Fornecedor / CNPJ</th>
                <th>Situação</th>
                <th>Anexo</th>
                <th>Valor Total</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {notasFiltradas.length > 0 ? notasFiltradas.map((nota) => (
                <tr key={nota.id}>
                  <td style={{ fontWeight: '600' }}>{nota.numero_nfe}</td>
                  <td>
                    <strong>{nota.razao_social}</strong>
                    <br />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{nota.cnpj}</span>
                  </td>
                  <td>
                    <span className="btn-sm" style={{ backgroundColor: '#f1f5f9', borderRadius: '12px', fontWeight: 'bold' }}>{nota.situacao}</span>
                  </td>
                  <td>
                    {nota.arquivo_url ? (
                      <a href={nota.arquivo_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary" style={{padding: '2px 6px', fontSize: '0.75rem'}}>👁 Ver</a>
                    ) : <span style={{color: '#ccc', fontSize: '0.85rem'}}>Nenhum</span>}
                  </td>
                  <td style={{ color: 'var(--viapro-green)', fontWeight: '700' }}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(nota.valor_nfe)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingNota(nota)} className="btn btn-sm btn-warning">Editar</button>
                      <button onClick={() => handleDelete(nota.id, nota.numero_nfe)} className="btn btn-sm btn-danger">Excluir</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum registro nesta página.</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* CONTROLES DE PAGINAÇÃO PREMIUM */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button 
              disabled={pagina === 0} 
              onClick={() => setPagina(prev => prev - 1)} 
              className="btn btn-logout btn-sm"
            >
              ◀ Página Anterior
            </button>
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>Página {pagina + 1}</span>
            <button 
              disabled={!temMais} 
              onClick={() => setPagina(prev => prev + 1)} 
              className="btn btn-logout btn-sm"
            >
              Próxima Página ▶
            </button>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editingNota && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="card-header">
              <h2>Editar Nota Fiscal ({editingNota.numero_nfe})</h2>
              <button onClick={() => setEditingNota(null)} className="btn btn-danger" style={{ padding: '0.2rem 0.6rem' }}>X</button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="form-grid">
                <div className="form-column">
                  <div className="input-group">
                    <label>Razão Social</label>
                    <input type="text" className="input-field" value={editingNota.razao_social} onChange={(e) => setEditingNota({...editingNota, razao_social: e.target.value})} required />
                  </div>
                  <div className="input-group">
                    <label>Chave de Acesso</label>
                    <input type="text" className="input-field" value={editingNota.chave_acesso} onChange={(e) => setEditingNota({...editingNota, chave_acesso: e.target.value})} required />
                  </div>
                  <div className="input-group">
                    <label>Situação da Nota</label>
                    <select className="input-field" value={editingNota.situacao} onChange={(e) => setEditingNota({...editingNota, situacao: e.target.value})} required>
                      <option value="Lançada">Lançada</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Cancelada">Cancelada</option>
                      <option value="Devolvida">Devolvida</option>
                    </select>
                  </div>
                </div>
                <div className="form-column">
                  <div className="input-group">
                    <label>Nº NF-e</label>
                    <input type="text" className="input-field" value={editingNota.numero_nfe} onChange={(e) => setEditingNota({...editingNota, numero_nfe: e.target.value})} required />
                  </div>
                  <div className="input-group">
                    <label>Valor Total (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editingNota.valor_nfe} onChange={(e) => setEditingNota({...editingNota, valor_nfe: parseFloat(e.target.value)})} required />
                  </div>
                </div>
                <div className="form-column" style={{ gridColumn: 'span 2' }}>
                  <div className="input-group">
                    <label>Observações Adicionais</label>
                    <textarea className="input-field" value={editingNota.observacao || ''} onChange={(e) => setEditingNota({...editingNota, observacao: e.target.value})} rows={3} style={{ resize: 'vertical' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setEditingNota(null)} className="btn btn-logout">Cancelar</button>
                <button type="submit" disabled={editLoading} className="btn btn-primary">{editLoading ? 'Salvando...' : 'Salvar Alterações'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}