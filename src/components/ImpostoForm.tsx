import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';

export function ImpostoForm() {
  const anexoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    mes_apuracao: '',
    mensal_ano_anterior: '',
    faturamento_mes: '',    
    rbt12: '',              
    compras: '',            
    situacao: 'Aberto'
  });

  const [calculo, setCalculo] = useState({
    porcentagem_compras: 0,  
    anexo: 'Anexo II (4º)',
    faixa: '-',              
    aliquota_nominal: 0,     
    parcela_deduzir: 0,      
    pct_icms: 32,            
    pct_pis_cofins: 14,      
    aliquota_efetiva: 0,     
    receita_icms_normal: 0,  
    valor_simples: 0,        
    porcentagem_validacao: 0,
    irpj: 0, csll: 0, cofins: 0, pis: 0, cpp: 0, icms: 0, ipi: 0
  });

  const [acumuladoAno, setAcumuladoAno] = useState({
    faturamento: 0,
    compras: 0,
    porcentagem_evento380: 0,
    ano_detectado: new Date().getFullYear().toString()
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRemoverAnexo = () => {
    setSelectedFile(null);
    setFileName('');
    if (anexoInputRef.current) anexoInputRef.current.value = '';
  };

  const buscarAcumuladoAno = async (ano: string) => {
    if (!ano) return;
    const { data } = await supabase
      .from('impostos')
      .select('faturamento_mes, compras')
      .like('mes_apuracao', `${ano}-%`);
    
    if (data) {
      const totalFat = data.reduce((acc, curr) => acc + (Number(curr.faturamento_mes) || 0), 0);
      const totalComp = data.reduce((acc, curr) => acc + (Number(curr.compras) || 0), 0);
      const pctGlobal = totalFat > 0 ? (totalComp / totalFat) * 100 : 0;

      setAcumuladoAno({
        faturamento: totalFat,
        compras: totalComp,
        porcentagem_evento380: pctGlobal,
        ano_detectado: CampanhaAno(ano)
      });
    }
  };

  const CampanhaAno = (anoStr: string) => anoStr;

  useEffect(() => {
    const ano = formData.mes_apuracao ? formData.mes_apuracao.split('-')[0] : new Date().getFullYear().toString();
    buscarAcumuladoAno(ano);
  }, [formData.mes_apuracao]);

  useEffect(() => {
    const faturamentoMes = parseFloat(formData.faturamento_mes) || 0; 
    const rbt12 = parseFloat(formData.rbt12) || 0;                   
    const compras = parseFloat(formData.compras) || 0;                 

    const porcentagemCompras = faturamentoMes > 0 ? (compras / faturamentoMes) * 100 : 0;

    if (rbt12 > 0 && faturamentoMes > 0) {
      let faixa = ''; let alNominal = 0; let deducao = 0;
      let pIcms = 32; let pPisCofins = 14;

      if (rbt12 <= 180000) { faixa = '1ª Faixa'; alNominal = 4.5; deducao = 0; }
      else if (rbt12 <= 360000) { faixa = '2ª Faixa'; alNominal = 7.8; deducao = 5940; }
      else if (rbt12 <= 720000) { faixa = '3ª Faixa'; alNominal = 10.0; deducao = 13860; }
      else if (rbt12 <= 1800000) { faixa = '4ª Faixa'; alNominal = 11.2; deducao = 22500; }
      else if (rbt12 <= 3600000) { faixa = '5ª Faixa'; alNominal = 14.7; deducao = 85500; }
      else { faixa = '6ª Faixa'; alNominal = 30.0; deducao = 720000; pIcms = 0; pPisCofins = 25.5; }

      const aliquotaNominalDecimal = alNominal / 100;
      const aliquotaEfetiva = ((rbt12 * aliquotaNominalDecimal) - deducao) / rbt12;
      const receitaIcmsNormal = faturamentoMes;
      const valorSimples = receitaIcmsNormal * aliquotaEfetiva;
      const porcentagemValidacao = receitaIcmsNormal > 0 ? (valorSimples / receitaIcmsNormal) * 100 : 0;

      let r_irpj = 0.055, r_csll = 0.035, r_cofins = 0.1151, r_pis = 0.0249, r_cpp = 0.375, r_icms = 0.32, r_ipi = 0.075;
      if (faixa === '6ª Faixa') {
        r_irpj = 0.085; r_csll = 0.075; r_cofins = 0.2096; r_pis = 0.0454; r_cpp = 0.235; r_icms = 0.00; r_ipi = 0.35;
      }

      setCalculo({
        porcentagem_compras: parseFloat(porcentagemCompras.toFixed(4)),
        anexo: 'Anexo II (4º)',
        faixa,
        aliquota_nominal: alNominal,
        parcela_deduzir: deducao,
        pct_icms: pIcms,
        pct_pis_cofins: pPisCofins,
        aliquota_efetiva: parseFloat(aliquotaEfetiva.toFixed(6)), 
        receita_icms_normal: receitaIcmsNormal,
        valor_simples: parseFloat(valorSimples.toFixed(2)),
        porcentagem_validacao: parseFloat(porcentagemValidacao.toFixed(4)),
        irpj: parseFloat((valorSimples * r_irpj).toFixed(2)),
        csll: parseFloat((valorSimples * r_csll).toFixed(2)),
        cofins: parseFloat((valorSimples * r_cofins).toFixed(2)),
        pis: parseFloat((valorSimples * r_pis).toFixed(2)),
        cpp: parseFloat((valorSimples * r_cpp).toFixed(2)),
        icms: parseFloat((valorSimples * r_icms).toFixed(2)),
        ipi: parseFloat((valorSimples * r_ipi).toFixed(2))
      });
    } else {
      setCalculo(prev => ({ ...prev, porcentagem_compras: porcentagemCompras, faixa: '-', aliquota_nominal: 0, parcela_deduzir: 0, aliquota_efetiva: 0, receita_icms_normal: 0, valor_simples: 0, porcentagem_validacao: 0, irpj: 0, csll: 0, cofins: 0, pis: 0, cpp: 0, icms: 0, ipi: 0 }));
    }
  }, [formData.faturamento_mes, formData.rbt12, formData.compras]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    let urlArquivoFinal = '';

    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop();
      const fileNameUpload = `imposto_estruturado_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('documentos').upload(fileNameUpload, selectedFile);
      
      if (uploadError) {
        Swal.fire('Erro no Anexo', uploadError.message, 'error');
        setLoading(false); return;
      }
      const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(fileNameUpload);
      urlArquivoFinal = publicUrlData.publicUrl;
    }

    const { error } = await supabase
      .from('impostos')
      .insert([{
        mes_apuracao: formData.mes_apuracao,
        mensal_ano_anterior: parseFloat(formData.mensal_ano_anterior) || 0,
        faturamento_mes: parseFloat(formData.faturamento_mes) || 0,
        rbt12: parseFloat(formData.rbt12) || 0,
        compras: parseFloat(formData.compras) || 0,
        porcentagem_compras: calculo.porcentagem_compras || 0,
        anexo: calculo.anexo,
        faixa: calculo.faixa,
        aliquota_nominal: calculo.aliquota_nominal || 0,
        parcela_deduzir: calculo.parcela_deduzir || 0,
        pct_icms: calculo.pct_icms || 0,
        pct_pis_cofins: calculo.pct_pis_cofins || 0,
        aliquota_efetiva: (calculo.aliquota_efetiva || 0) * 100, 
        receita_icms_normal: calculo.receita_icms_normal || 0,
        valor_das: calculo.valor_simples || 0, 
        porcentagem_validacao: calculo.porcentagem_validacao || 0,
        irpj: calculo.irpj || 0,
        csll: calculo.csll || 0,
        cofins: calculo.cofins || 0,
        pis: calculo.pis || 0,
        cpp: calculo.cpp || 0,
        icms: calculo.icms || 0,
        ipi: calculo.ipi || 0,
        situacao: formData.situacao,
        arquivo_url: urlArquivoFinal
      }]);

    if (error) {
      Swal.fire('Erro ao Salvar', error.message, 'error');
    } else {
      Swal.fire('Sucesso!', 'Dados fiscais gravados com sucesso.', 'success');
      const anoAtual = formData.mes_apuracao ? formData.mes_apuracao.split('-')[0] : new Date().getFullYear().toString();
      await buscarAcumuladoAno(anoAtual);
      setFormData({ mes_apuracao: '', mensal_ano_anterior: '', faturamento_mes: '', rbt12: '', compras: '', situacao: 'Aberto' });
      handleRemoverAnexo();
      window.dispatchEvent(new Event('impostoSalvo'));
    }
    setLoading(false);
  };

  const formatarMoeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Painel de Apuração - Estrutura Mestre</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          
          <div className="form-column">
            <h3 style={{ color: 'var(--viapro-blue)', fontSize: '0.9rem', marginBottom: '1rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.3rem' }}>
              Dados de Entrada
            </h3>
            
            <div className="input-group">
              <label>Mês de Referência</label>
              <input type="month" name="mes_apuracao" className="input-field" value={formData.mes_apuracao} onChange={handleChange} required />
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.5rem' }}>RECEITA BRUTA</strong>
              <div className="input-group">
                <label>Mensal do Ano Anterior</label>
                <input type="number" step="0.01" name="mensal_ano_anterior" className="input-field" value={formData.mensal_ano_anterior} onChange={handleChange} placeholder="Ex: 61910.62" />
              </div>
              <div className="input-group" style={{ marginTop: '0.5rem' }}>
                <label>Mensal do Mês Atual (C3)</label>
                <input type="number" step="0.01" name="faturamento_mes" className="input-field" value={formData.faturamento_mes} onChange={handleChange} required />
              </div>
              <div className="input-group" style={{ marginTop: '0.5rem' }}>
                <label>Últimos 12 Meses - RBT12 (D3)</label>
                <input type="number" step="0.01" name="rbt12" className="input-field" value={formData.rbt12} onChange={handleChange} required />
              </div>
            </div>

            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.5rem' }}>EVENTO 380</strong>
              <div className="input-group">
                <label>Compras (E3)</label>
                <input type="number" step="0.01" name="compras" className="input-field" value={formData.compras} onChange={handleChange} />
              </div>
            </div>

            <div className="input-group">
              <label>Status da Guia</label>
              <select name="situacao" className="input-field" value={formData.situacao} onChange={handleChange} required>
                <option value="Aberto">Em Aberto</option>
                <option value="Pago">Pago</option>
              </select>
            </div>

            <div className="input-group" style={{ marginTop: '0.5rem' }}>
              <label>Documento de Arrecadação</label>
              <input type="file" className="input-field" ref={anexoInputRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if(file) { setSelectedFile(file); setFileName(file.name); }
              }} />
              {fileName && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#ffffff', border: '1px dashed var(--border-color)' }}>
                  <span style={{fontSize: '0.8rem', color: 'var(--viapro-green)'}}>📎 {fileName}</span>
                  <button type="button" onClick={handleRemoverAnexo} className="btn btn-sm btn-danger" style={{padding: '2px 6px', fontSize: '0.7rem'}}>X</button>
                </div>
              )}
            </div>
          </div>

          <div className="form-column">
            <h3 style={{ color: 'var(--viapro-blue)', fontSize: '0.9rem', marginBottom: '1rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.3rem' }}>
              Processamento & Indústria
            </h3>

            {/* CORREÇÃO DO TYPO: REALIZADA A TROCA EM MASSA DE justifyWith PARA justifyContent */}
            <div style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 'var(--radius-md)', padding: '1.2rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', marginBottom: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 'bold' }}>Evento 380 - Porcentagem (%):</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'monospace' }}>{calculo.porcentagem_compras.toFixed(2)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', marginBottom: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 'bold' }}>Anexo:</span>
                <span style={{ marginLeft: 'auto' }}>{calculo.anexo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', marginBottom: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 'bold' }}>Faixa SN 2025:</span>
                <span style={{ marginLeft: 'auto' }}>{calculo.faixa}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', marginBottom: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 'bold' }}>Alíquota Nominal (I3):</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'monospace' }}>{calculo.aliquota_nominal}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', marginBottom: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 'bold' }}>Parcela a Deduzir (J3):</span>
                <span style={{ marginLeft: 'auto' }}>{formatarMoeda(calculo.parcela_deduzir)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', marginBottom: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 'bold' }}>% ICMS:</span>
                <span style={{ marginLeft: 'auto' }}>{calculo.pct_icms}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', marginBottom: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 'bold' }}>% PIS/COFINS:</span>
                <span style={{ marginLeft: 'auto' }}>{calculo.pct_pis_cofins}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', marginBottom: '0.4rem', borderBottom: '1px solid #e2e8f0', color: 'var(--viapro-blue)' }}>
                <span style={{ fontWeight: 'bold' }}>%-C/ICMS (Alíquota Efetiva M3):</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontWeight: 'bold' }}>{(calculo.aliquota_efetiva * 100).toFixed(4)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', marginBottom: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 'bold' }}>Receita c/ ICMS Normal (N3):</span>
                <span style={{ marginLeft: 'auto' }}>{formatarMoeda(calculo.receita_icms_normal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', marginBottom: '0.4rem', borderBottom: '1px solid #e2e8f0', color: 'var(--viapro-green)' }}>
                <span style={{ fontWeight: 'bold' }}>Simples (O3):</span>
                <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>{formatarMoeda(calculo.valor_simples)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>Porcentagem de Validação (% P3):</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'monospace' }}>{calculo.porcentagem_validacao.toFixed(4)}%</span>
              </div>
            </div>

            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e0f2fe', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid #bae6fd' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#0369a1', textTransform: 'uppercase' }}>Consolidação do Período</span>
              <span style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--viapro-blue)' }}>{formatarMoeda(calculo.valor_simples)}</span>
            </div>

            <div style={{ marginTop: '1.2rem' }}>
              <h4 style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem' }}>
                Indicadores Acumulados do Ano ({acumuladoAno.ano_detectado})
              </h4>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.8rem', borderRadius: '6px', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: '#166534', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Faturamento</span>
                  <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#15803d', display: 'block', marginTop: '0.2rem' }}>{formatarMoeda(acumuladoAno.faturamento)}</span>
                </div>
                <div style={{ flex: 1, backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '0.8rem', borderRadius: '6px', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: '#92400e', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Compras</span>
                  <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#b45309', display: 'block', marginTop: '0.2rem' }}>{formatarMoeda(acumuladoAno.compras)}</span>
                </div>
                <div style={{ flex: 1, backgroundColor: '#faf5ff', border: '1px solid #f3e8ff', padding: '0.8rem', borderRadius: '6px', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: '#6b21a8', fontWeight: 'bold', textTransform: 'uppercase' }}>Índice Evento 380</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#7e22ce', display: 'block', marginTop: '0.2rem', fontFamily: 'monospace' }}>{acumuladoAno.porcentagem_evento380.toFixed(2)}%</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        <button type="submit" disabled={loading} className="btn btn-success" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '1.5rem' }}>
          {loading ? 'Processando Fórmulas...' : 'Salvar e Registrar Período Fiscal'}
        </button>
      </form>
    </div>
  );
}