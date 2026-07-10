import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LogAuditoria {
  id: string;
  usuario: string;
  acao: string;
  tabela: string;
  detalhes: string;
  criado_at: string;
}

export function ListaAuditoria() {
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  // Filtros Avançados
  const [searchTerm, setSearchTerm] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('Todas');

  const executarBusca = async () => {
    setLoading(true);
    
    let query = supabase.from('logs_auditoria').select('*').order('criado_at', { ascending: false });

    // Filtro por termo (Usuário ou Detalhes)
    if (searchTerm) {
      query = query.or(`usuario.ilike.%${searchTerm}%,detalhes.ilike.%${searchTerm}%,tabela.ilike.%${searchTerm}%`);
    }

    // Filtro por Data
    if (dataInicio) query = query.gte('criado_at', `${dataInicio}T00:00:00.000Z`);
    if (dataFim) query = query.lte('criado_at', `${dataFim}T23:59:59.999Z`);

    // Filtro por Ação
    if (filtroAcao !== 'Todas') {
      query = query.eq('acao', filtroAcao);
    }

    // Limite de segurança para não pesar o navegador (últimos 500 registros)
    const { data, error } = await query.limit(500);

    if (error) {
      Swal.fire('Erro', `Falha ao carregar auditoria: ${error.message}`, 'error');
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    executarBusca();
  }, [searchTerm, dataInicio, dataFim, filtroAcao]);

  const limparFiltros = () => {
    setSearchTerm('');
    setDataInicio('');
    setDataFim('');
    setFiltroAcao('Todas');
  };

  // Formatação de Data e Hora Brasileira
  const formatarDataHora = (dataIso: string) => {
    const data = new Date(dataIso);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(data);
  };

  // Estilização das "Badges" de Ação para leitura visual rápida
  const getBadgeAcao = (acao: string) => {
    if (acao.includes('Criação')) return { backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' };
    if (acao.includes('Edição') || acao.includes('Atualização')) return { backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' };
    if (acao.includes('Exclusão')) return { backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' };
    return { backgroundColor: '#e2e8f0', color: '#334155', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' };
  };

  // Módulo de Exportação PDF
  const exportarPDF = async () => {
    try {
      setExportLoading(true);
      const doc = new jsPDF('landscape');
      
      doc.setFontSize(16);
      doc.text("Relatório de Auditoria e Rastreabilidade - VIAPRO", 14, 15);
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 22);

      const tableData = logs.map(l => [
        formatarDataHora(l.criado_at), l.usuario, l.acao, l.tabela.toUpperCase(), l.detalhes
      ]);

      autoTable(doc, {
        head: [['Data / Hora', 'Usuário', 'Ação', 'Módulo (Tabela)', 'Detalhes do Registro']],
        body: tableData, startY: 28, theme: 'grid', headStyles: { fillColor: [15, 23, 42] }, styles: { fontSize: 8 }
      });

      doc.save(`Auditoria_Sistema_${Date.now()}.pdf`);
    } finally {
      setExportLoading(false);
    }
  };

  // Módulo de Exportação Excel
  const exportarExcel = async () => {
    try {
      setExportLoading(true);
      const headers = ["DATA/HORA", "USUARIO", "ACAO", "MODULO_TABELA", "DETALHES"];
      const linhas = logs.map(l => [
        formatarDataHora(l.criado_at), l.usuario, l.acao, l.tabela, l.detalhes.replace(/;/g, ',') // Proteção contra quebra do CSV
      ]);

      const conteudoCSV = [headers.join(";"), ...linhas.map(linha => linha.join(";"))].join("\n");
      const blob = new Blob(["\uFEFF" + conteudoCSV], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `Auditoria_Sistema_${Date.now()}.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="premium-card">
      <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>Painel de Segurança e Auditoria</h2>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={exportarPDF} disabled={exportLoading} className="btn btn-sm" style={{ backgroundColor: '#1e293b', color: 'white', fontWeight: 'bold' }}>📄 Exportar PDF</button>
          <button onClick={exportarExcel} disabled={exportLoading} className="btn btn-sm" style={{ backgroundColor: '#10b981', color: 'white', fontWeight: 'bold' }}>📊 Exportar Excel</button>
        </div>
      </div>

      {/* PAINEL DE BUSCA DE AUDITORIA */}
      <div style={{ backgroundColor: '#f8fafc', padding: '1.2rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 250px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.4rem' }}>Busca (Usuário, Módulo ou Detalhe)</label>
            <input type="text" className="input-field" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Ex: email@viapro.com, exclusão..." />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.4rem' }}>Data Inicial</label>
            <input type="date" className="input-field" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.4rem' }}>Data Final</label>
            <input type="date" className="input-field" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.4rem' }}>Tipo de Ação</label>
            <select className="input-field" value={filtroAcao} onChange={e => setFiltroAcao(e.target.value)}>
              <option value="Todas">Todas as Ações</option>
              <option value="Criação de Registro">Criação</option>
              <option value="Edição de Registro">Edição</option>
              <option value="Exclusão de Registro">Exclusão</option>
            </select>
          </div>
          <div>
            <button onClick={limparFiltros} className="btn btn-logout" style={{ padding: '0.65rem 1.5rem' }}>Limpar Filtros</button>
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>A varrer registos de segurança...</p>
      ) : (
        <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto', overflowX: 'auto' }}>
          <table className="custom-table" style={{ minWidth: '1000px', fontSize: '0.85rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <tr>
                <th>DATA E HORA</th>
                <th>USUÁRIO AUTOR</th>
                <th>MÓDULO AFETADO</th>
                <th>TIPO DE AÇÃO</th>
                <th>DETALHES DA OPERAÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontWeight: 'bold', color: '#475569' }}>{formatarDataHora(log.criado_at)}</td>
                  <td style={{ color: 'var(--viapro-blue)', fontWeight: '600' }}>{log.usuario}</td>
                  <td style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>{log.tabela.replace('_', ' ')}</td>
                  <td><span style={getBadgeAcao(log.acao)}>{log.acao}</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>{log.detalhes}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🛡️</span>
                    Nenhum registo de auditoria encontrado para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}