import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
}

export function ListaFaturamento() {
  const [titulos, setTitulos] = useState<Faturamento[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingTitulo, setEditingTitulo] = useState<Faturamento | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const buscarTitulos = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('faturamento').select('*').order('data_vencimento', { ascending: true });
    if (error) setError(error.message);
    else setTitulos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    buscarTitulos();
    window.addEventListener('faturamentoSalvo', buscarTitulos);
    return () => window.removeEventListener('faturamentoSalvo', buscarTitulos);
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Atenção: Tem certeza que deseja excluir este lançamento permanentemente?")) return;
    const { error } = await supabase.from('faturamento').delete().eq('id', id);
    if (error) alert(`Erro ao excluir: ${error.message}`);
    else setTitulos(titulos.filter(t => t.id !== id));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTitulo) return;
    
    setEditLoading(true);
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
      alert(`Erro ao atualizar: ${error.message}`);
    } else {
      setEditingTitulo(null);
      buscarTitulos();
    }
    setEditLoading(false);
  };

  const titulosFiltrados = titulos.filter(t => {
    const termo = searchTerm.toLowerCase();
    return (
      t.tipo.toLowerCase().includes(termo) ||
      t.status.toLowerCase().includes(termo) ||
      (t.metodo_pagamento && t.metodo_pagamento.toLowerCase().includes(termo))
    );
  });

  // FUNÇÃO DE EXPORTAÇÃO PARA EXCEL (CSV)
  const exportarParaCSV = () => {
    const headers = ["Tipo", "Status", "Data de Vencimento", "Data de Pagamento", "Método", "Valor Liquido"];
    
    // Mapeia apenas as colunas que importam para o financeiro
    const linhas = titulosFiltrados.map(t => [
      t.tipo,
      t.status,
      t.data_vencimento,
      t.data_pagamento || 'N/A',
      t.metodo_pagamento || 'N/A',
      t.valor_liquido.toFixed(2)
    ]);

    const conteudoCSV = [
      headers.join(";"), // Separador em ponto e vírgula previne erros no Excel pt-BR
      ...linhas.map(linha => linha.join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + conteudoCSV], { type: 'text/csv;charset=utf-8;' }); // BOM para acentos
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Fluxo_Caixa_VIAPRO.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Fluxo de Caixa (Contas a Pagar / Receber)</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Buscar por tipo, status ou método..." 
            className="search-bar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={buscarTitulos} className="btn btn-primary">Atualizar</button>
          
          {/* NOVO BOTÃO DE EXPORTAÇÃO */}
          <button onClick={exportarParaCSV} className="btn btn-export">
             ⬇ Exportar (Excel)
          </button>
        </div>
      </div>

      {error && <div className="status-msg status-error">Erro: {error}</div>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Buscando dados financeiros...</p>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Status</th>
                <th>Vencimento</th>
                <th>Pagamento</th>
                <th>Método</th>
                <th>Valor Líquido</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {titulosFiltrados.length > 0 ? titulosFiltrados.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: '700', color: t.tipo === 'A Receber' ? 'var(--viapro-green)' : '#ef4444' }}>
                    {t.tipo === 'A Receber' ? '↑ ' : '↓ '}{t.tipo}
                  </td>
                  <td><span style={getStatusBadge(t.status)}>{t.status}</span></td>
                  <td>{formatarData(t.data_vencimento)}</td>
                  <td>{formatarData(t.data_pagamento)}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.metodo_pagamento || '-'}</td>
                  <td style={{ fontWeight: '700' }}>{formatarMoeda(t.valor_liquido)}</td>
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
        </div>
      )}

      {/* Modal de Edição (Oculto) */}
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
                <button type="submit" disabled={editLoading} className="btn btn-primary">{editLoading ? 'Salvando...' : 'Salvar Alterações'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}