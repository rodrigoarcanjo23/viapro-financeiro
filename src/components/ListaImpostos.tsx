import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Imposto {
  id: string;
  competencia: string;
  aliquota_simples_efetiva: number;
  valor_das: number;
  icms_st: number;
  iss_retido: number;
  inss_retido: number;
}

export function ListaImpostos() {
  const [impostos, setImpostos] = useState<Imposto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingImposto, setEditingImposto] = useState<Imposto | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const buscarImpostos = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('impostos').select('*').order('competencia', { ascending: false });
    if (error) setError(error.message);
    else setImpostos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    buscarImpostos();
    window.addEventListener('impostoSalvo', buscarImpostos);
    return () => window.removeEventListener('impostoSalvo', buscarImpostos);
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Atenção: Deseja excluir este registro de imposto permanentemente?")) return;
    const { error } = await supabase.from('impostos').delete().eq('id', id);
    if (error) alert(`Erro ao excluir: ${error.message}`);
    else setImpostos(impostos.filter(i => i.id !== id));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingImposto) return;
    setEditLoading(true);

    const { error } = await supabase.from('impostos').update({
      competencia: editingImposto.competencia,
      aliquota_simples_efetiva: editingImposto.aliquota_simples_efetiva,
      valor_das: editingImposto.valor_das,
      icms_st: editingImposto.icms_st,
      iss_retido: editingImposto.iss_retido,
      inss_retido: editingImposto.inss_retido
    }).eq('id', editingImposto.id);

    if (error) {
      alert(`Erro ao atualizar: ${error.message}`);
    } else {
      setEditingImposto(null);
      buscarImpostos();
    }
    setEditLoading(false);
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarCompetencia = (comp: string) => {
    if (!comp) return '-';
    const [ano, mes] = comp.split('-');
    return `${mes}/${ano}`;
  };

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Histórico de Tributação</h2>
        <button onClick={buscarImpostos} className="btn btn-primary">Atualizar</button>
      </div>

      {error && <div className="status-msg status-error">Erro: {error}</div>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Buscando dados de impostos...</p>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Competência</th>
                <th>Alíquota Efetiva</th>
                <th>Valor do DAS</th>
                <th>Retenções (ICMS/ISS/INSS)</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {impostos.length > 0 ? impostos.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: '700' }}>{formatarCompetencia(i.competencia)}</td>
                  <td>{i.aliquota_simples_efetiva}%</td>
                  <td style={{ color: '#ef4444', fontWeight: '700' }}>{formatarMoeda(i.valor_das)}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    ICMS: {formatarMoeda(i.icms_st)} | ISS: {formatarMoeda(i.iss_retido)} | INSS: {formatarMoeda(i.inss_retido)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingImposto(i)} className="btn btn-sm btn-warning">Editar</button>
                      <button onClick={() => handleDelete(i.id)} className="btn btn-sm btn-danger">Excluir</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Nenhum registro de imposto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Janela Modal de Edição */}
      {editingImposto && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="card-header">
              <h2>Editar Tributação ({formatarCompetencia(editingImposto.competencia)})</h2>
              <button onClick={() => setEditingImposto(null)} className="btn btn-danger" style={{ padding: '0.2rem 0.6rem' }}>X</button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="form-grid">
                <div className="form-column">
                  <div className="input-group">
                    <label>Competência</label>
                    <input type="month" className="input-field" value={editingImposto.competencia} onChange={(e) => setEditingImposto({...editingImposto, competencia: e.target.value})} required />
                  </div>
                  <div className="input-group">
                    <label>Alíquota Efetiva (%)</label>
                    <input type="number" step="0.01" className="input-field" value={editingImposto.aliquota_simples_efetiva} onChange={(e) => setEditingImposto({...editingImposto, aliquota_simples_efetiva: parseFloat(e.target.value)})} required />
                  </div>
                  <div className="input-group">
                    <label>Valor DAS (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editingImposto.valor_das} onChange={(e) => setEditingImposto({...editingImposto, valor_das: parseFloat(e.target.value)})} required />
                  </div>
                </div>
                <div className="form-column">
                  <div className="input-group">
                    <label>ICMS ST (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editingImposto.icms_st} onChange={(e) => setEditingImposto({...editingImposto, icms_st: parseFloat(e.target.value)})} />
                  </div>
                  <div className="input-group">
                    <label>ISS Retido (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editingImposto.iss_retido} onChange={(e) => setEditingImposto({...editingImposto, iss_retido: parseFloat(e.target.value)})} />
                  </div>
                  <div className="input-group">
                    <label>INSS Retido (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editingImposto.inss_retido} onChange={(e) => setEditingImposto({...editingImposto, inss_retido: parseFloat(e.target.value)})} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setEditingImposto(null)} className="btn btn-logout">Cancelar</button>
                <button type="submit" disabled={editLoading} className="btn btn-primary">{editLoading ? 'Salvando...' : 'Salvar Alterações'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}