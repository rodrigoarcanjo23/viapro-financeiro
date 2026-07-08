import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface NotaSaida {
  id: string;
  cnpj: string;
  razao_social: string;
  chave_acesso: string;
  uf: string;
  data_emissao: string;
  numero_nfe: string;
  valor_nfe: number;
}

export function ListaNotasSaida() {
  const [notas, setNotas] = useState<NotaSaida[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para Edição (Modal)
  const [editingNota, setEditingNota] = useState<NotaSaida | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const buscarNotas = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('notas_saida').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setNotas(data || []);
    setLoading(false);
  };

  useEffect(() => {
    buscarNotas();
    // Escuta o evento do formulário para atualizar a lista automaticamente
    window.addEventListener('notaSaidaSalva', buscarNotas);
    return () => window.removeEventListener('notaSaidaSalva', buscarNotas);
  }, []);

  // Funcionalidade de Exclusão
  const handleDelete = async (id: string) => {
    if (!window.confirm("Atenção: Tem certeza que deseja excluir esta nota de saída permanentemente?")) return;
    
    const { error } = await supabase.from('notas_saida').delete().eq('id', id);
    if (error) {
      alert(`Erro ao excluir: ${error.message}`);
    } else {
      setNotas(notas.filter(nota => nota.id !== id));
    }
  };

  // Funcionalidade de Edição (Atualiza no banco)
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNota) return;
    
    setEditLoading(true);
    const { error } = await supabase.from('notas_saida').update({
      razao_social: editingNota.razao_social,
      chave_acesso: editingNota.chave_acesso,
      uf: editingNota.uf,
      data_emissao: editingNota.data_emissao,
      numero_nfe: editingNota.numero_nfe,
      valor_nfe: editingNota.valor_nfe
    }).eq('id', editingNota.id);

    if (error) {
      alert(`Erro ao atualizar: ${error.message}`);
    } else {
      setEditingNota(null);
      buscarNotas(); // Recarrega os dados atualizados
    }
    setEditLoading(false);
  };

  // Filtro de Busca Inteligente
  const notasFiltradas = notas.filter(nota => {
    const termo = searchTerm.toLowerCase();
    return (
      nota.razao_social.toLowerCase().includes(termo) ||
      nota.cnpj.includes(termo) ||
      nota.numero_nfe.includes(termo)
    );
  });

  const formatarCNPJ = (cnpj: string) => {
    if (cnpj.length !== 14) return cnpj;
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const formatarData = (dataStr: string) => {
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Histórico de Notas de Saída</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Busca Inteligente */}
          <input 
            type="text" 
            placeholder="Buscar por cliente, CNPJ ou NF-e..." 
            className="search-bar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={buscarNotas} className="btn btn-primary">Atualizar</button>
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
                <th>Nº NF-e</th>
                <th>Cliente (Razão / CNPJ)</th>
                <th>Emissão</th>
                <th>Valor Total</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {notasFiltradas.length > 0 ? notasFiltradas.map((nota) => (
                <tr key={nota.id}>
                  <td style={{ fontWeight: '600' }}>{nota.numero_nfe}</td>
                  <td>
                    <strong style={{ color: 'var(--text-main)' }}>{nota.razao_social}</strong>
                    <br />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {formatarCNPJ(nota.cnpj)} ({nota.uf})
                    </span>
                  </td>
                  <td>{formatarData(nota.data_emissao)}</td>
                  <td style={{ color: 'var(--viapro-green)', fontWeight: '700' }}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(nota.valor_nfe)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingNota(nota)} className="btn btn-sm btn-warning">Editar</button>
                      <button onClick={() => handleDelete(nota.id)} className="btn btn-sm btn-danger">Excluir</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Nenhuma nota de saída encontrada para esta busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Janela Modal de Edição */}
      {editingNota && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="card-header">
              <h2>Editar Nota de Saída ({editingNota.numero_nfe})</h2>
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
                    <label>UF</label>
                    <input type="text" className="input-field" value={editingNota.uf} onChange={(e) => setEditingNota({...editingNota, uf: e.target.value})} required maxLength={2} />
                  </div>
                </div>
                <div className="form-column">
                  <div className="input-group">
                    <label>Data de Emissão</label>
                    <input type="date" className="input-field" value={editingNota.data_emissao} onChange={(e) => setEditingNota({...editingNota, data_emissao: e.target.value})} required />
                  </div>
                  <div className="input-group">
                    <label>Nº NF-e</label>
                    <input type="text" className="input-field" value={editingNota.numero_nfe} onChange={(e) => setEditingNota({...editingNota, numero_nfe: e.target.value})} required />
                  </div>
                  <div className="input-group">
                    <label>Valor Total (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editingNota.valor_nfe} onChange={(e) => setEditingNota({...editingNota, valor_nfe: parseFloat(e.target.value)})} required />
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