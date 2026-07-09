import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';

interface NotaSaida {
  id: string;
  cnpj: string;
  razao_social: string;
  chave_acesso: string;
  uf: string;
  data_emissao: string;
  numero_nfe: string;
  valor_nfe: number;
  arquivo_url?: string;
}

export function ListaNotasSaida() {
  const [notas, setNotas] = useState<NotaSaida[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [pagina, setPagina] = useState(0);
  const itensPorPagina = 5;
  const [temMais, setTemMais] = useState(true);

  const [editingNota, setEditingNota] = useState<NotaSaida | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const executarBusca = async (termo = searchTerm, inicio = dataInicio, fim = dataFim, resetPage = false) => {
    setLoading(true);
    setError(null);
    const currentPage = resetPage ? 0 : pagina;
    if (resetPage) setPagina(0);

    let query = supabase.from('notas_saida').select('*');

    if (termo) {
      const termClean = termo.replace(/\D/g, '');
      let orString = `razao_social.ilike.%${termo}%,numero_nfe.ilike.%${termo}%`;
      if (termClean) {
        orString += `,cnpj.ilike.%${termClean}%`;
      }
      query = query.or(orString);
    }

    if (inicio) query = query.gte('data_emissao', inicio);
    if (fim) query = query.lte('data_emissao', fim);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(currentPage * itensPorPagina, (currentPage + 1) * itensPorPagina - 1);

    if (error) {
      setError(error.message);
    } else {
      if (data.length < itensPorPagina) setTemMais(false);
      else setTemMais(true);
      setNotas(data || []);
    }
    setLoading(false);
  };

  const limparFiltros = () => {
    setSearchTerm(''); setDataInicio(''); setDataFim('');
    executarBusca('', '', '', true);
  };

  useEffect(() => {
    executarBusca(searchTerm, dataInicio, dataFim, false);
  }, [pagina]);

  useEffect(() => {
    const listener = () => executarBusca(searchTerm, dataInicio, dataFim, true);
    window.addEventListener('notaSaidaSalva', listener);
    return () => window.removeEventListener('notaSaidaSalva', listener);
  }, [searchTerm, dataInicio, dataFim]);

  const handleDelete = async (id: string, numero: string) => {
    const result = await Swal.fire({
      title: 'Eliminar Nota de Saída?',
      text: `Confirma a exclusão da NF-e nº ${numero}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sim, eliminar!',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('notas_saida').delete().eq('id', id);
    
    if (error) {
      Swal.fire('Erro!', `Falha ao eliminar: ${error.message}`, 'error');
    } else {
      await supabase.from('logs_auditoria').insert([{
        usuario: user?.email || 'Sistema',
        acao: 'Exclusão de Registo',
        tabela: 'notas_saida',
        detalhes: `NF-e de Saída nº ${numero} removida do sistema.`
      }]);
      Swal.fire('Eliminada!', 'A nota de saída foi apagada.', 'success');
      executarBusca(searchTerm, dataInicio, dataFim, true);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNota) return;
    setEditLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('notas_saida').update({
      razao_social: editingNota.razao_social,
      chave_acesso: editingNota.chave_acesso,
      uf: editingNota.uf,
      data_emissao: editingNota.data_emissao,
      numero_nfe: editingNota.numero_nfe,
      valor_nfe: editingNota.valor_nfe
    }).eq('id', editingNota.id);

    if (error) {
      Swal.fire('Erro!', `Não foi possível atualizar: ${error.message}`, 'error');
    } else {
      await supabase.from('logs_auditoria').insert([{
        usuario: user?.email || 'Sistema',
        acao: 'Edição de Registo',
        tabela: 'notas_saida',
        registro_id: editingNota.id,
        detalhes: `Dados da NF-e de Saída nº ${editingNota.numero_nfe} foram atualizados.`
      }]);
      
      Swal.fire({
        icon: 'success',
        title: 'Atualizado!',
        text: 'As alterações foram guardadas.',
        timer: 1500,
        showConfirmButton: false
      });
      
      setEditingNota(null);
      executarBusca(searchTerm, dataInicio, dataFim, false);
    }
    setEditLoading(false);
  };

  const formatarCNPJ = (cnpj: string) => {
    if (cnpj.length !== 14) return cnpj;
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const formatarData = (dataStr: string) => {
    if (!dataStr) return '-';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  return (
    <div className="premium-card">
      <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '1rem' }}>
        <h2>Histórico de Notas de Saída</h2>
      </div>

      <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 300px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.5rem' }}>
              Busca (Cliente, CNPJ ou Nº NF-e)
            </label>
            <input type="text" className="input-field" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Ex: Viapro, 48.673..." />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.5rem' }}>
              Emissão (De)
            </label>
            <input type="date" className="input-field" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.5rem' }}>
              Emissão (Até)
            </label>
            <input type="date" className="input-field" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => executarBusca(searchTerm, dataInicio, dataFim, true)} className="btn btn-primary" style={{ padding: '0.65rem 1.5rem' }}>🔍 Filtrar</button>
            <button onClick={limparFiltros} className="btn btn-logout" style={{ padding: '0.65rem 1.5rem' }}>Limpar</button>
          </div>
        </div>
      </div>

      {error && <div className="status-msg status-error">Erro: {error}</div>}

      {loading && notas.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>A procurar dados paginados no servidor...</p>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Nº NF-e</th>
                <th>Cliente (Razão / CNPJ)</th>
                <th>Emissão</th>
                <th>Anexo</th>
                <th>Valor Total</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {notas.length > 0 ? notas.map((nota) => (
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
                  <td>
                    {nota.arquivo_url ? (
                      <a href={nota.arquivo_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary" style={{padding: '2px 8px', fontSize: '0.75rem'}}>👁 Ver</a>
                    ) : <span style={{color: '#ccc', fontSize: '0.85rem'}}>Nenhum</span>}
                  </td>
                  <td style={{ color: 'var(--viapro-green)', fontWeight: '700' }}>
                    {formatarMoeda(nota.valor_nfe)}
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
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Nenhuma nota de saída encontrada para estes filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button disabled={pagina === 0} onClick={() => setPagina(prev => prev - 1)} className="btn btn-logout btn-sm">◀ Página Anterior</button>
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>Página {pagina + 1}</span>
            <button disabled={!temMais} onClick={() => setPagina(prev => prev + 1)} className="btn btn-logout btn-sm">Próxima Página ▶</button>
          </div>
        </div>
      )}

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
                <button type="submit" disabled={editLoading} className="btn btn-primary">{editLoading ? 'A Guardar...' : 'Guardar Alterações'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}