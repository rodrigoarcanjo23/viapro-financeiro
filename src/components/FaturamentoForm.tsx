import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function FaturamentoForm() {
  const [formData, setFormData] = useState({
    tipo: 'A Pagar',
    status: 'Pendente',
    data_vencimento: '',
    data_pagamento: '',
    valor_bruto: '',
    descontos: '0',
    acrescimos: '0',
    valor_liquido: '0',
    metodo_pagamento: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | null>(null);

  // Calcula o Valor Líquido automaticamente
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase
      .from('faturamento')
      .insert([{
        tipo: formData.tipo,
        status: formData.status,
        data_vencimento: formData.data_vencimento,
        data_pagamento: formData.data_pagamento || null, // Nulo se estiver vazio
        valor_bruto: parseFloat(formData.valor_bruto),
        descontos: parseFloat(formData.descontos) || 0,
        acrescimos: parseFloat(formData.acrescimos) || 0,
        valor_liquido: parseFloat(formData.valor_liquido),
        metodo_pagamento: formData.metodo_pagamento
      }]);

    if (error) {
      setMsgType('error');
      setMessage(`Erro ao registrar título: ${error.message}`);
    } else {
      setMsgType('success');
      setMessage('Título financeiro registrado com sucesso!');
      setFormData({
        tipo: 'A Pagar', status: 'Pendente', data_vencimento: '', data_pagamento: '',
        valor_bruto: '', descontos: '0', acrescimos: '0', valor_liquido: '0', metodo_pagamento: ''
      });
      
      // Atualiza a lista automaticamente
      window.dispatchEvent(new Event('faturamentoSalvo'));
    }
    setLoading(false);
  };

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Lançamento Financeiro</h2>
      </div>
      
      {message && (
        <div className={`status-msg ${msgType === 'error' ? 'status-error' : 'status-success'}`}>
          {message}
        </div>
      )}

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
              <input 
                type="text" 
                className="input-field" 
                value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(formData.valor_liquido) || 0)} 
                disabled 
                style={{ backgroundColor: '#e2e8f0', fontWeight: 'bold', color: 'var(--viapro-blue)' }} 
              />
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