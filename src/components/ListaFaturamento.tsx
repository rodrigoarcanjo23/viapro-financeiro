import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';

interface Faturamento {
  id: string;
  tipo: string;
  status: string;
  data_vencimento: string;
  data_pagamento: string;
  valor_bruto: number;
  descontos: number;
  acrescimos: number;
  valor_liquido: number;
  metodo_pagamento: string;
  arquivo_url?: string;
}

export function ListaFaturamento() {
  const [titulos, setTitulos] = useState<Faturamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [pagina, setPagina] = useState(0);
  const itensPorPagina = 5;
  const [temMais, setTemMais] = useState(true);

  const [editingTitulo, setEditingTitulo] = useState<Faturamento | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const executarBusca = async (termo = searchTerm, inicio = dataInicio, fim = dataFim, resetPage = false) => {
    setLoading(true);
    setError(null);
    const currentPage = resetPage ? 0 : pagina;
    if (resetPage) setPagina(0);

    let query = supabase.from('faturamento').select('*');

    if (termo) {
      query = query.or(`tipo.ilike.%${termo}%,status.ilike.%${termo}%,metodo_pagamento.ilike.%${termo}%`);
    }

    if (inicio) query = query.gte('data_vencimento', inicio);
    if (fim) query = query.lte('data_vencimento', fim);

    const { data, error } = await query
      .order('data_vencimento', { ascending: true })
      .range(currentPage * itensPorPagina, (currentPage + 1) * itensPorPagina - 1);

    if (error) {
      setError(error.message);
    } else {
      if (data.length < itensPorPagina) setTemMais(false);
      else setTemMais(true);
      setTitulos(data || []);
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
    window.addEventListener('faturamentoSalvo', listener);
    return () => window.removeEventListener('faturamentoSalvo', listener);
  }, [searchTerm, dataInicio, dataFim]);

  // ALERTA PREMIUM DE ELIMINAÇÃO
  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Eliminar Título?',
      text: "Esta ação é irreversível!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sim, eliminar!',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('faturamento').delete().eq('id', id);
    
    if (error) {
      Swal.fire('Erro!', `Falha ao eliminar: ${error.message}`, 'error');
    } else {
      await supabase.from('logs_auditoria').insert([{
        usuario: user?.email || 'Sistema',
        acao: 'Exclusão de Registo',
        tabela: 'faturamento',
        detalhes: `Lançamento financeiro removido.`
      }]);
      Swal.fire('Eliminado!', 'O título financeiro foi apagado.', 'success');
      executarBusca(searchTerm, dataInicio, dataFim, true);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTitulo) return;
    setEditLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const liquido = (editingTitulo.valor_bruto || 0) - (editingTitulo.descontos || 0) + (editingTitulo.acrescimos || 0);

    const { error } = await supabase.from('faturamento').update({
      tipo: editingTitulo.tipo,
      status: editingTitulo.status,
      data_vencimento: editingTitulo.data_vencimento,
      data_pagamento: editingTitulo.data_pagamento || null,
      valor_bruto: editingTitulo.valor_bruto,
      descontos: editingTitulo.descontos,
      acrescimos: editingTitulo.acrescimos,
      valor_liquido: liquido,
      metodo_pagamento: editingTitulo.metodo_pagamento
    }).eq('id', editingTitulo.id);

    if (error) {
      Swal.fire('Erro!', `Não foi possível atualizar: ${error.message}`, 'error');
    } else {
      await supabase.from('logs_auditoria').insert([{
        usuario: user?.email || 'Sistema',
        acao: 'Edição de Registo',
        tabela: 'faturamento',
        registro_id: editingTitulo.id,
        detalhes: `Status alterado para ${editingTitulo.status}.`
      }]);
      
      // TOAST PREMIUM DE SUCESSO
      Swal.fire({
        icon: 'success',
        title: 'Atualizado!',
        text: 'As alterações foram guardadas com sucesso.',
        timer: 1500,
        showConfirmButton: false
      });
      
      setEditingTitulo(null);
      executarBusca(searchTerm, dataInicio, dataFim, false);
    }
    setEditLoading(false);
  };

  const exportarParaCSV = async () => {
    setExportLoading(true);
    let query = supabase.from('faturamento').select('*').order('data_vencimento', { ascending: true });

    if (searchTerm) {
      query = query.or(`tipo.ilike.%${searchTerm}%,status.ilike.%${searchTerm}%,metodo_pagamento.ilike.%${searchTerm}%`);
    }
    if (dataInicio) query = query.gte('data_vencimento', dataInicio);
    if (dataFim) query = query.lte('data_vencimento', dataFim);

    const { data, error } = await query;
    if (error) {
      Swal.fire('Erro!', 'Ocorreu um erro ao gerar a exportação.', 'error');
      setExportLoading(false);
      return;
    }

    const headers = ["Tipo", "Status", "Vencimento", "Pagamento", "Método", "Valor Liquido"];
    const linhas = data.map(t => [
      t.tipo,
      t.status,
      t.data_vencimento,
      t.data_pagamento || 'N/A',
      t.metodo_pagamento || 'N/A',
      t.valor_liquido.toFixed(2).replace('.', ',')
    ]);

    const conteudoCSV = [
      headers.join(";"), 
      ...linhas.map(linha => linha.join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + conteudoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Fluxo_Caixa_VIAPRO.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setExportLoading(false);
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarData = (dataStr: string) => {
    if (!dataStr) return '-';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Pago') return { backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' };
    if (status === 'Atrasado' || status === 'Cancelado') return { backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' };
    if (status === 'Pago Parcialmente') return { backgroundColor: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' };
    return { backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' };
  };

  const getTipoCor = (tipo: string) => {
    return tipo === 'A Receber' ? 'var(--viapro-green)' : '#ef4444';
  };

  return (
    <div className="premium-card">
      <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '1rem' }}>
        <h2>Fluxo de Caixa (Contas a Pagar / Receber)</h2>
        <button onClick={exportarParaCSV} disabled={exportLoading} className="btn btn-export">
          {exportLoading ? 'A Gerar...' : '⬇ Exportar Relatório (Excel)'}
        </button>
      </div>

      <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 300px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.5rem' }}>
              Busca (Tipo, Status ou Método)
            </label>
            <input type="text" className="input-field" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Ex: PIX, Atrasado, Pagar..." />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.5rem' }}>
              Vencimento (De)
            </label>
            <input type="date" className="input-field" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.5rem' }}>
              Vencimento (Até)
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

      {loading && titulos.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>A procurar dados financeiros...</p>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Status</th>
                <th>Vencimento</th>
                <th>Método</th>
                <th>Anexo</th>
                <th>Valor Líquido</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {titulos.length > 0 ? titulos.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: '700', color: getTipoCor(t.tipo) }}>
                    {t.tipo === 'A Receber' ? '↑ ' : '↓ '}{t.tipo}
                  </td>
                  <td><span style={getStatusBadge(t.status)}>{t.status}</span></td>
                  <td>{formatarData(t.data_vencimento)}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.metodo_pagamento || '-'}</td>
                  <td>
                    {t.arquivo_url ? (
                      <a href={t.arquivo_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary" style={{padding: '2px 8px', fontSize: '0.75rem'}}>👁 Ver</a>
                    ) : <span style={{color: '#ccc', fontSize: '0.85rem'}}>Nenhum</span>}
                  </td>
                  <td style={{ fontWeight: '700' }}>
                    {formatarMoeda(t.valor_liquido)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingTitulo(t)} className="btn btn-sm btn-warning">Editar</button>
                      <button onClick={() => handleDelete(t.id)} className="btn btn-sm btn-danger">Excluir</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Nenhum lançamento financeiro encontrado.
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

      {editingTitulo && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="card-header">
              <h2>Editar Lançamento</h2>
              <button onClick={() => setEditingTitulo(null)} className="btn btn-danger" style={{ padding: '0.2rem 0.6rem' }}>X</button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="form-grid">
                <div className="form-column">
                  <div className="input-group">
                    <label>Tipo</label>
                    <select className="input-field" value={editingTitulo.tipo} onChange={(e) => setEditingTitulo({...editingTitulo, tipo: e.target.value})} required>
                      <option value="A Pagar">Contas a Pagar</option>
                      <option value="A Receber">Contas a Receber</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Status</label>
                    <select className="input-field" value={editingTitulo.status} onChange={(e) => setEditingTitulo({...editingTitulo, status: e.target.value})} required>
                      <option value="Pendente">Pendente</option>
                      <option value="Pago">Pago</option>
                      <option value="Pago Parcialmente">Pago Parcialmente</option>
                      <option value="Atrasado">Atrasado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Data de Vencimento</label>
                    <input type="date" className="input-field" value={editingTitulo.data_vencimento} onChange={(e) => setEditingTitulo({...editingTitulo, data_vencimento: e.target.value})} required />
                  </div>
                  <div className="input-group">
                    <label>Data de Pagamento</label>
                    <input type="date" className="input-field" value={editingTitulo.data_pagamento || ''} onChange={(e) => setEditingTitulo({...editingTitulo, data_pagamento: e.target.value})} />
                  </div>
                </div>
                <div className="form-column">
                  <div className="input-group">
                    <label>Método de Pagamento</label>
                    <select className="input-field" value={editingTitulo.metodo_pagamento || ''} onChange={(e) => setEditingTitulo({...editingTitulo, metodo_pagamento: e.target.value})}>
                      <option value="">Selecione...</option>
                      <option value="PIX">PIX</option>
                      <option value="Boleto">Boleto</option>
                      <option value="Transferência">Transferência Bancária</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Dinheiro">Dinheiro</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Valor Bruto (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editingTitulo.valor_bruto} onChange={(e) => setEditingTitulo({...editingTitulo, valor_bruto: parseFloat(e.target.value)})} required />
                  </div>
                  <div className="input-group">
                    <label>Descontos (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editingTitulo.descontos} onChange={(e) => setEditingTitulo({...editingTitulo, descontos: parseFloat(e.target.value)})} />
                  </div>
                  <div className="input-group">
                    <label>Acréscimos (R$)</label>
                    <input type="number" step="0.01" className="input-field" value={editingTitulo.acrescimos} onChange={(e) => setEditingTitulo({...editingTitulo, acrescimos: parseFloat(e.target.value)})} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setEditingTitulo(null)} className="btn btn-logout">Cancelar</button>
                <button type="submit" disabled={editLoading} className="btn btn-primary">{editLoading ? 'A Guardar...' : 'Guardar Alterações'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}