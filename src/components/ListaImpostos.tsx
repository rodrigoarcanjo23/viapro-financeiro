import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Imposto {
  id: string;
  mes_apuracao: string;
  mensal_ano_anterior: number;
  faturamento_mes: number;
  rbt12: number;
  compras: number;
  porcentagem_compras: number;
  anexo: string;
  faixa: string;
  aliquota_nominal: number;
  parcela_deduzir: number;
  aliquota_efetiva: number;
  valor_das: number;
  irpj: number;
  csll: number;
  cofins: number;
  pis: number;
  cpp: number;
  icms: number;
  ipi: number;
  situacao: string;
  arquivo_url?: string;
}

export function ListaImpostos() {
  const [impostos, setImpostos] = useState<Imposto[]>([]);
  const [impostosFiltrados, setImpostosFiltrados] = useState<Imposto[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [filtroSituacao, setFiltroSituacao] = useState('Todos');

  const [acumulado, setAcumulado] = useState({
    faturamento: 0,
    compras: 0,
    porcentagem_evento380: 0
  });

  const executarBusca = async () => {
    setLoading(true);
    const { data } = await supabase.from('impostos').select('*').order('mes_apuracao', { ascending: false });
    if (data) {
      setImpostos(data);
      aplicarFiltrosLocais(data, filtroAno, filtroSituacao);
    }
    setLoading(false);
  };

  const aplicarFiltrosLocais = (dados: Imposto[], ano: string, situacao: string) => {
    let filtrados = [...dados];

    if (ano) {
      filtrados = filtrados.filter(i => i.mes_apuracao.startsWith(ano));
    }

    if (situacao !== 'Todos') {
      filtrados = filtrados.filter(i => i.situacao === situacao);
    }

    setImpostosFiltrados(filtrados);

    const totalFat = filtrados.reduce((acc, curr) => acc + (Number(curr.faturamento_mes) || 0), 0);
    const totalComp = filtrados.reduce((acc, curr) => acc + (Number(curr.compras) || 0), 0);
    const pctGlobal = totalFat > 0 ? (totalComp / totalFat) * 100 : 0;

    setAcumulado({
      faturamento: totalFat,
      compras: totalComp,
      porcentagem_evento380: pctGlobal
    });
  };

  const limparFiltros = () => {
    setFiltroAno('');
    setFiltroSituacao('Todos');
    setImpostosFiltrados(impostos);
    aplicarFiltrosLocais(impostos, '', 'Todos');
  };

  useEffect(() => {
    executarBusca();
    window.addEventListener('impostoSalvo', executarBusca);
    return () => window.removeEventListener('impostoSalvo', executarBusca);
  }, []);

  useEffect(() => {
    aplicarFiltrosLocais(impostos, filtroAno, filtroSituacao);
  }, [filtroAno, filtroSituacao, impostos]);

  const handleDelete = async (id: string, mes: string) => {
    const result = await Swal.fire({
      title: 'Excluir Apuração?', text: `Confirma a exclusão dos impostos do período de ${formatarMesAno(mes)}?`, icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'Sim, excluir!'
    });

    if (!result.isConfirmed) return;
    await supabase.from('impostos').delete().eq('id', id);
    Swal.fire('Excluído!', 'Apuração removida com sucesso.', 'success');
    executarBusca();
  };

  const formatarMesAno = (dataStr: string) => {
    if (!dataStr) return '-';
    if (!dataStr.includes('-')) return dataStr;
    const [ano, mes] = dataStr.split('-');
    const meses: { [key: string]: string } = {
      '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
      '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
      '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
    };
    return `${meses[mes] || mes} - ${ano}`;
  };

  const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

  const exportarPDF = async () => {
    try {
      setExportLoading(true);
      const doc = new jsPDF('landscape', 'pt', 'a3');
      doc.setFontSize(16); doc.text("Relatório Completo de Impostos (Anexo II) - VIAPRO", 14, 15);
      
      const tableData = impostosFiltrados.map(n => [
        formatarMesAno(n.mes_apuracao), n.faturamento_mes.toLocaleString('pt-BR'), n.rbt12.toLocaleString('pt-BR'), 
        `${n.aliquota_efetiva.toFixed(2)}%`, n.valor_das.toLocaleString('pt-BR'),
        n.irpj.toLocaleString('pt-BR'), n.csll.toLocaleString('pt-BR'), n.cofins.toLocaleString('pt-BR'),
        n.pis.toLocaleString('pt-BR'), n.cpp.toLocaleString('pt-BR'), n.icms.toLocaleString('pt-BR'), n.ipi.toLocaleString('pt-BR')
      ]);

      autoTable(doc, {
        head: [['PERÍODO', 'FATURAMENTO', 'RBT12', '% SIMPLES', 'DAS', 'IRPJ', 'CSLL', 'COFINS', 'PIS', 'CPP', 'ICMS', 'IPI']],
        body: tableData, startY: 28, theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [30, 64, 175] }
      });

      doc.save(`Planilha_Impostos_Filtrados_${Date.now()}.pdf`);
    } finally { setExportLoading(false); }
  };

  const exportarExcel = async () => {
    try {
      setExportLoading(true);
      const headers = ["PERIODO", "FATURAMENTO", "RBT12", "% SIMPLES", "DAS", "COMPRAS", "%", "ANEXO", "FAIXA", "ALIQ NOMINAL", "DEDUCAO", "IRPJ", "CSLL", "COFINS", "PIS", "CPP", "ICMS", "IPI", "SITUACAO"];
      const linhas = impostosFiltrados.map(n => [
        formatarMesAno(n.mes_apuracao), n.faturamento_mes.toFixed(2).replace('.', ','), n.rbt12.toFixed(2).replace('.', ','),
        n.aliquota_efetiva.toFixed(4).replace('.', ','), n.valor_das.toFixed(2).replace('.', ','), n.compras.toFixed(2).replace('.', ','),
        n.porcentagem_compras.toFixed(2).replace('.', ','), n.anexo, n.faixa, n.aliquota_nominal.toFixed(2).replace('.', ','),
        n.parcela_deduzir.toFixed(2).replace('.', ','), n.irpj.toFixed(2).replace('.', ','), n.csll.toFixed(2).replace('.', ','),
        n.cofins.toFixed(2).replace('.', ','), n.pis.toFixed(2).replace('.', ','), n.cpp.toFixed(2).replace('.', ','),
        n.icms.toFixed(2).replace('.', ','), n.ipi.toFixed(2).replace('.', ','), n.situacao
      ]);

      const conteudoCSV = [headers.join(";"), ...linhas.map(l => l.join(";"))].join("\n");
      const blob = new Blob(["\uFEFF" + conteudoCSV], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `Planilha_Impostos_Filtrados_${Date.now()}.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } finally { setExportLoading(false); }
  };

  return (
    <div className="premium-card">
      <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>Histórico de Apurações (Fórmulas Integradas)</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={exportarPDF} disabled={exportLoading} className="btn btn-sm" style={{ backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold' }}>📄 PDF</button>
          <button onClick={exportarExcel} disabled={exportLoading} className="btn btn-sm" style={{ backgroundColor: '#10b981', color: 'white', fontWeight: 'bold' }}>📊 Excel</button>
        </div>
      </div>

      <div style={{ backgroundColor: '#f8fafc', padding: '1.2rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.4rem' }}>Filtrar por Ano (Ex: 2026)</label>
            <input type="number" className="input-field" value={filtroAno} onChange={e => setFiltroAno(e.target.value)} placeholder="Todos os anos..." />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--viapro-blue)', marginBottom: '0.4rem' }}>Situação da Guia DAS</label>
            <select className="input-field" value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)}>
              <option value="Todos">Todos os Status</option>
              <option value="Aberto">Em Aberto</option>
              <option value="Pago">Pago</option>
            </select>
          </div>
          <div>
            <button onClick={limparFiltros} className="btn btn-logout" style={{ padding: '0.65rem 1.5rem' }}>Limpar Filtros</button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.8rem', borderRadius: '6px', textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '0.65rem', color: '#166534', fontWeight: 'bold', textTransform: 'uppercase' }}>Faturamento Acumulado (Filtro)</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#15803d', display: 'block', marginTop: '0.2rem' }}>{formatarMoeda(acumulado.faturamento)}</span>
          </div>
          <div style={{ flex: '1 1 200px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '0.8rem', borderRadius: '6px', textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '0.65rem', color: '#92400e', fontWeight: 'bold', textTransform: 'uppercase' }}>Compras Acumuladas (Filtro)</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#b45309', display: 'block', marginTop: '0.2rem' }}>{formatarMoeda(acumulado.compras)}</span>
          </div>
          <div style={{ flex: '1 1 200px', backgroundColor: '#faf5ff', border: '1px solid #f3e8ff', padding: '0.8rem', borderRadius: '6px', textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: '0.65rem', color: '#6b21a8', fontWeight: 'bold', textTransform: 'uppercase' }}>Índice Evento 380 (Filtro)</span>
            <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#7e22ce', display: 'block', marginTop: '0.2rem', fontFamily: 'monospace' }}>{acumulado.porcentagem_evento380.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>A carregar dados...</p>
      ) : (
        <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto', overflowX: 'auto' }}>
          <table className="custom-table" style={{ minWidth: '1800px', fontSize: '0.8rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <tr>
                <th>PERÍODO</th>
                <th>FATURAMENTO</th>
                <th>RBT12</th>
                <th>% SIMPLES</th>
                <th>DAS</th>
                <th>COMPRAS</th>
                <th>%</th>
                <th>ANEXO</th>
                <th>FAIXA</th>
                <th>ALIQ. NOM.</th>
                <th>DEDUÇÃO</th>
                <th>IRPJ</th>
                <th>CSLL</th>
                <th>COFINS</th>
                <th>PIS</th>
                <th>CPP</th>
                <th>ICMS</th>
                <th>IPI</th>
                <th style={{ textAlign: 'right' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {impostosFiltrados.length > 0 ? impostosFiltrados.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 'bold', color: 'var(--viapro-blue)' }}>{formatarMesAno(i.mes_apuracao)}</td>
                  <td>{formatarMoeda(i.faturamento_mes)}</td>
                  <td>{formatarMoeda(i.rbt12)}</td>
                  <td style={{ backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 'bold' }}>{i.aliquota_efetiva.toFixed(4)}%</td>
                  <td style={{ color: 'var(--viapro-green)', fontWeight: 'bold' }}>{formatarMoeda(i.valor_das)}</td>
                  <td>{formatarMoeda(i.compras)}</td>
                  <td>{i.porcentagem_compras.toFixed(2)}%</td>
                  <td>{i.anexo}</td>
                  <td>{i.faixa}</td>
                  <td>{i.aliquota_nominal}%</td>
                  <td>{formatarMoeda(i.parcela_deduzir)}</td>
                  <td>{formatarMoeda(i.irpj)}</td>
                  <td>{formatarMoeda(i.csll)}</td>
                  <td>{formatarMoeda(i.cofins)}</td>
                  <td>{formatarMoeda(i.pis)}</td>
                  <td>{formatarMoeda(i.cpp)}</td>
                  <td>{formatarMoeda(i.icms)}</td>
                  <td>{formatarMoeda(i.ipi)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      {i.arquivo_url && <a href={i.arquivo_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary" style={{padding: '2px 8px', fontSize: '0.7rem'}}>👁 Guia</a>}
                      <button onClick={() => handleDelete(i.id, i.mes_apuracao)} className="btn btn-sm btn-danger" style={{padding: '2px 8px', fontSize: '0.7rem'}}>X</button>
                    </div>
                  </td>
                </tr>
              )) : (<tr><td colSpan={19} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum registro encontrado para a busca realizada.</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}