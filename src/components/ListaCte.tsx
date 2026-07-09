import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Cte {
  id: string;
  chave_acesso: string;
  numero_documento: string;
  cgf_emitente: string;
  razao_social_emitente: string;
  data_emissao: string;
  valor_total_servico: number;
  base_calculo_icms: number;
  icms_destacado: number;
  situacao: string;
  arquivo_url?: string;
}

export function ListaCte() {
  const [ctes, setCtes] = useState<Cte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [editingCte, setEditingCte] = useState<Cte | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const executarBusca = async (termo = searchTerm, inicio = dataInicio, fim = dataFim) => {
    setLoading(true); setError(null);

    let query = supabase.from('cte').select('*');

    if (termo) {
      query = query.or(`razao_social_emitente.ilike.%${termo}%,numero_documento.ilike.%${termo}%,chave_acesso.ilike.%${termo}%`);
    }

    if (inicio) query = query.gte('data_emissao', inicio);
    if (fim) query = query.lte('data_emissao', fim);

    const { data, error } = await query.order('data_emissao', { ascending: false });

    if (error) setError(error.message);
    else setCtes(data || []);
    
    setLoading(false);
  };

  const limparFiltros = () => {
    setSearchTerm(''); setDataInicio(''); setDataFim('');
    executarBusca('', '', '');
  };

  useEffect(() => { executarBusca(); }, []);

  useEffect(() => {
    const listener = () => executarBusca();
    window.addEventListener('cteSalvo', listener);
    return () => window.removeEventListener('cteSalvo', listener);
  }, [searchTerm, dataInicio, dataFim]);

  const buscarDadosParaExportacao = async () => {
    let query = supabase.from('cte').select('*').order('data_emissao', { ascending: true });
    if (searchTerm) {
      query = query.or(`razao_social_emitente.ilike.%${searchTerm}%,numero_documento.ilike.%${searchTerm}%,chave_acesso.ilike.%${searchTerm}%`);
    }
    if (dataInicio) query = query.gte('data_emissao', dataInicio);
    if (dataFim) query = query.lte('data_emissao', dataFim);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  const exportarPDF = async () => {
    try {
      setExportLoading(true);
      const data = await buscarDadosParaExportacao();
      const doc = new jsPDF('landscape');
      
      doc.setFontSize(16);
      doc.text("Relatório de Conhecimentos de Transporte (CTE) - VIAPRO", 14, 15);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22);

      const tableData = data.map(n => [
        n.numero_documento, n.razao_social_emitente, formatarData(n.data_emissao), formatarMoeda(n.valor_total_servico), n.situacao
      ]);

      autoTable(doc, {
        head: [['Nº Doc.', 'Transportadora', 'Emissão', 'Valor Total', 'Situação']],
        body: tableData, startY: 28, theme: 'grid', headStyles: { fillColor: [30, 64, 175] }
      });

      doc.save(`Relatorio_CTE_${Date.now()}.pdf`);
    } catch (err) {
      Swal.fire('Erro', 'Falha ao gerar PDF.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const exportarXML = async () => {
    try {
      setExportLoading(true);
      const data = await buscarDadosParaExportacao();
      
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<RelatorioCTE>\n';
      data.forEach(n => {
        xml += '  <CTE>\n';
        xml += `    <NumeroDoc>${n.numero_documento}</NumeroDoc>\n`;
        xml += `    <ChaveAcesso>${n.chave_acesso}</ChaveAcesso>\n`;
        xml += `    <RazaoSocial>${n.razao_social_emitente.replace(/&/g, '&amp;')}</RazaoSocial>\n`;
        xml += `    <DataEmissao>${n.data_emissao}</DataEmissao>\n`;
        xml += `    <ValorServico>${n.valor_total_servico}</ValorServico>\n`;
        xml += `    <BaseICMS>${n.base_calculo_icms}</BaseICMS>\n`;
        xml += `    <ICMSDestacado>${n.icms_destacado}</ICMSDestacado>\n`;
        xml += `    <Situacao>${n.situacao}</Situacao>\n`;
        xml += '  </CTE>\n';
      });
      xml += '</RelatorioCTE>';

      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `Relatorio_CTE_${Date.now()}.xml`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (err) {
      Swal.fire('Erro', 'Falha ao gerar XML.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const exportarExcel = async () => {
    try {
      setExportLoading(true);
      const data = await buscarDadosParaExportacao();
      
      const headers = ["Nº Doc", "Chave", "Transportadora", "CGF", "Emissao", "Valor Servico", "Base ICMS", "ICMS Destacado", "Situacao"];
      const linhas = data.map(n => [
        n.numero_documento, n.chave_acesso, n.razao_social_emitente, n.cgf_emitente || 'N/A',
        n.data_emissao, n.valor_total_servico.toFixed(2).replace('.', ','), 
        n.base_calculo_icms.toFixed(2).replace('.', ','), n.icms_destacado.toFixed(2).replace('.', ','), n.situacao
      ]);

      const conteudoCSV = [headers.join(";"), ...linhas.map(l => l.join(";"))].join("\n");
      const blob = new Blob(["\uFEFF" + conteudoCSV], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `Relatorio_CTE_${Date.now()}.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (err) {
      Swal.fire('Erro', 'Falha ao gerar Excel.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDelete = async (id: string, numero: string) => {
    const result = await Swal.fire({
      title: 'Eliminar CTE?', text: `Confirma a exclusão permanente do CTE nº ${numero}?`, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'Sim, eliminar!', cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('cte').delete().eq('id', id);
    
    if (error) Swal.fire('Erro!', `Falha ao eliminar: ${error.message}`, 'error');
    else {
      await supabase.from('logs_auditoria').insert([{ usuario: user?.email || 'Sistema', acao: 'Exclusão de Registo', tabela: 'cte', detalhes: `CTE nº ${numero} removido do sistema.` }]);
      Swal.fire('Eliminado!', 'O CTE foi apagado com sucesso.', 'success');
      executarBusca();
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCte) return;
    setEditLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('cte').update({
      razao_social_emitente: editingCte.razao_social_emitente, chave_acesso: editingCte.chave_acesso,
      numero_documento: editingCte.numero_documento, data_emissao: editingCte.data_emissao,
      cgf_emitente: editingCte.cgf_emitente, valor_total_servico: editingCte.valor_total_servico,
      base_calculo_icms: editingCte.base_calculo_icms, icms_destacado: editingCte.icms_destacado, situacao: editingCte.situacao
    }).eq('id', editingCte.id);

    if (error) Swal.fire('Erro!', `Não foi possível atualizar: ${error.message}`, 'error');
    else {
      await supabase.from('logs_auditoria').insert([{ usuario: user?.email || 'Sistema', acao: 'Edição de Registo', tabela: 'cte', registro_id: editingCte.id, detalhes: `Dados do CTE nº ${editingCte.numero_documento} foram atualizados.` }]);
      Swal.fire({ icon: 'success', title: 'Atualizado!', text: 'As alterações foram guardadas.', timer: 1500, showConfirmButton: false });
      setEditingCte(null);
      executarBusca();
    }
    setEditLoading(false);
  };

  const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
  const formatarData = (dataStr: string) => { if (!dataStr) return '-'; const [ano, mes, dia] = dataStr.split('-'); return `${dia}/${mes}/${ano}`; };

  const getBadgeStyle = (situacao: string) => {
    if (situacao === 'Autorizado') return { backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' };
    if (situacao === 'Cancelado') return { backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' };
    return { backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' };
  };

  return (
    <div className="premium-card">
      <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>Histórico de Transportes (CTE)</h2>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={exportarPDF} disabled={exportLoading} className="btn btn-sm" style={{ backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold' }}>
            {exportLoading ? 'A Gerar...' : '📄 PDF'}
          </button>
          <button onClick={exportarXML} disabled={exportLoading} className="btn btn-sm" style={{ backgroundColor: '#f59e0b', color: 'white', fontWeight: 'bold' }}>
            {exportLoading ? 'A Gerar...' : '📝 XML'}
          </button>
          <button onClick={exportarExcel} disabled={exportLoading} className="btn btn-sm" style={{ backgroundColor: '#10b981', color: 'white', fontWeight: 'bold' }}>
            {exportLoading ? 'A Gerar...' : '📊 Excel'}
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 300px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.5rem' }}>Busca (Transportadora ou Nº Doc)</label>
            <input type="text" className="input-field" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Ex: Trans CJ..." />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.5rem' }}>Emissão (De)</label>
            <input type="date" className="input-field" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.5rem' }}>Emissão (Até)</label>
            <input type="date" className="input-field" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => executarBusca()} className="btn btn-primary" style={{ padding: '0.65rem 1.5rem' }}>🔍 Filtrar</button>
            <button onClick={limparFiltros} className="btn btn-logout" style={{ padding: '0.65rem 1.5rem' }}>Limpar</button>
          </div>
        </div>
      </div>

      {error && <div className="status-msg status-error">Erro: {error}</div>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>A procurar dados no servidor...</p>
      ) : (
        <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto', overflowX: 'auto' }}>
          <table className="custom-table" style={{ minWidth: '1000px' }}>
            {/* CORREÇÃO DO CABEÇALHO FLUTUANTE */}
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <tr>
                <th>Nº Doc.</th>
                <th>Transportadora</th>
                <th>Chave de Acesso</th>
                <th>Emissão</th>
                <th>Base ICMS</th>
                <th>ICMS Destacado</th>
                <th>Valor Serviço</th>
                <th>Anexo</th>
                <th>Situação</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ctes.length > 0 ? ctes.map((cte) => (
                <tr key={cte.id}>
                  <td style={{ fontWeight: '600' }}>{cte.numero_documento}</td>
                  <td><strong style={{ color: 'var(--text-main)' }}>{cte.razao_social_emitente}</strong></td>
                  <td>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', wordBreak: 'break-all', maxWidth: '160px' }}>
                      {cte.chave_acesso}
                    </div>
                  </td>
                  <td>{formatarData(cte.data_emissao)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatarMoeda(cte.base_calculo_icms)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatarMoeda(cte.icms_destacado)}</td>
                  <td style={{ color: 'var(--viapro-green)', fontWeight: '700' }}>{formatarMoeda(cte.valor_total_servico)}</td>
                  <td>{cte.arquivo_url ? <a href={cte.arquivo_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary" style={{padding: '2px 8px', fontSize: '0.75rem'}}>👁 Ver</a> : <span style={{color: '#ccc', fontSize: '0.85rem'}}>Nenhum</span>}</td>
                  <td><span style={getBadgeStyle(cte.situacao)}>{cte.situacao}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingCte(cte)} className="btn btn-sm btn-warning">Editar</button>
                      <button onClick={() => handleDelete(cte.id, cte.numero_documento)} className="btn btn-sm btn-danger">Excluir</button>
                    </div>
                  </td>
                </tr>
              )) : (<tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum CTE encontrado para estes filtros.</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

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
                    <label>Data de Emissão</label>
                    <input type="date" className="input-field" value={editingCte.data_emissao || ''} onChange={(e) => setEditingCte({...editingCte, data_emissao: e.target.value})} required />
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
                      <option value="Autorizado">Autorizado</option><option value="Cancelado">Cancelado</option><option value="Recusado">Recusado</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => setEditingCte(null)} className="btn btn-logout">Cancelar</button>
                <button type="submit" disabled={editLoading} className="btn btn-primary">{editLoading ? 'A Guardar...' : 'Guardar Alterações'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}