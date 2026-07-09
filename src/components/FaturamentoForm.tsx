import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function FaturamentoForm() {
  const anexoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    tipo: 'A Pagar', status: 'Pendente', data_vencimento: '', data_pagamento: '',
    valor_bruto: '', descontos: '0', acrescimos: '0', valor_liquido: '0', metodo_pagamento: ''
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    const bruto = parseFloat(formData.valor_bruto) || 0;
    const desc = parseFloat(formData.descontos) || 0;
    const acresc = parseFloat(formData.acrescimos) || 0;
    const liquido = bruto - desc + acresc;
    setFormData(prev => ({ ...prev, valor_liquido: liquido.toFixed(2) }));
  }, [formData.valor_bruto, formData.descontos, formData.acrescimos]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRemoverAnexo = () => {
    setSelectedFile(null);
    setFileName('');
    if (anexoInputRef.current) anexoInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { data: { user } } = await supabase.auth.getUser();
    let urlArquivoFinal = '';

    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop();
      const fileNameUpload = `financeiro_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(fileNameUpload, selectedFile);

      if (uploadError) {
        setMsgType('error');
        setMessage(`Erro ao fazer upload do anexo: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(fileNameUpload);
      urlArquivoFinal = publicUrlData.publicUrl;
    }

    const { data: fatData, error } = await supabase
      .from('faturamento')
      .insert([{
        tipo: formData.tipo, status: formData.status, data_vencimento: formData.data_vencimento,
        data_pagamento: formData.data_pagamento || null, valor_bruto: parseFloat(formData.valor_bruto),
        descontos: parseFloat(formData.descontos) || 0, acrescimos: parseFloat(formData.acrescimos) || 0,
        valor_liquido: parseFloat(formData.valor_liquido), metodo_pagamento: formData.metodo_pagamento,
        arquivo_url: urlArquivoFinal
      }])
      .select('id').single();

    if (error) {
      setMsgType('error');
      setMessage(`Erro ao registrar título: ${error.message}`);
    } else {
      await supabase.from('logs_auditoria').insert([{
        usuario: user?.email || 'Sistema', acao: 'Criação de Registro', tabela: 'faturamento',
        registro_id: fatData?.id, detalhes: `Novo título ${formData.tipo} registrado no valor de R$ ${formData.valor_liquido}`
      }]);

      setMsgType('success');
      setMessage('Título financeiro registrado com sucesso!');
      setFormData({
        tipo: 'A Pagar', status: 'Pendente', data_vencimento: '', data_pagamento: '',
        valor_bruto: '', descontos: '0', acrescimos: '0', valor_liquido: '0', metodo_pagamento: ''
      });
      handleRemoverAnexo(); // Limpa o anexo
      window.dispatchEvent(new Event('faturamentoSalvo'));
    }
    setLoading(false);
  };

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Lançamento Financeiro</h2>
      </div>
      
      {message && <div className={`status-msg ${msgType === 'error' ? 'status-error' : 'status-success'}`}>{message}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-column">
            <div className="input-group">
              <label>Tipo de Título</label>
              <select name="tipo" className="input-field" value={formData.tipo} onChange={handleChange} required>
                <option value="A Pagar">Contas a Pagar (Despesa)</option>
                <option value="A Receber">Contas a Receber (Receita)</option>
              </select>
            </div>
            <div className="input-group">
              <label>Status</label>
              <select name="status" className="input-field" value={formData.status} onChange={handleChange} required>
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
                <option value="Pago Parcialmente">Pago Parcialmente</option>
                <option value="Atrasado">Atrasado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
            <div className="input-group">
              <label>Data de Vencimento</label>
              <input type="date" name="data_vencimento" className="input-field" value={formData.data_vencimento} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Data de Pagamento / Recebimento</label>
              <input type="date" name="data_pagamento" className="input-field" value={formData.data_pagamento} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>Método de Pagamento</label>
              <select name="metodo_pagamento" className="input-field" value={formData.metodo_pagamento} onChange={handleChange}>
                <option value="">Selecione...</option>
                <option value="PIX">PIX</option>
                <option value="Boleto">Boleto</option>
                <option value="Transferência">Transferência Bancária</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Dinheiro">Dinheiro</option>
              </select>
            </div>
          </div>

          <div className="form-column">
            <div className="input-group">
              <label>Valor Bruto (R$)</label>
              <input type="number" step="0.01" name="valor_bruto" className="input-field" value={formData.valor_bruto} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Descontos (R$)</label>
              <input type="number" step="0.01" name="descontos" className="input-field" value={formData.descontos} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>Acréscimos / Juros (R$)</label>
              <input type="number" step="0.01" name="acrescimos" className="input-field" value={formData.acrescimos} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>Valor Líquido Final (R$)</label>
              <input type="text" className="input-field" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(formData.valor_liquido) || 0)} disabled style={{ backgroundColor: '#e2e8f0', fontWeight: 'bold', color: 'var(--viapro-blue)' }} />
            </div>
            
            <div className="input-group" style={{ marginTop: '0.5rem' }}>
              <label>Anexar Boleto / Comprovante</label>
              <input type="file" className="input-field" ref={anexoInputRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if(file) { setSelectedFile(file); setFileName(file.name); }
              }} />
              
              {fileName && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.8rem', padding: '0.6rem 1rem', backgroundColor: '#f8fafc', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{fontSize: '0.85rem', color: 'var(--viapro-green)', fontWeight: '600'}}>📎 {fileName}</span>
                  <button type="button" onClick={handleRemoverAnexo} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>
                    ✖ Remover
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--border-color)', margin: '2rem 0 1.5rem', borderStyle: 'solid' }} />

        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
          {loading ? 'Processando...' : 'Lançar Título Financeiro'}
        </button>
      </form>
    </div>
  );
}