import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function ImpostosForm() {
  const [formData, setFormData] = useState({
    competencia: '',
    aliquota_simples_efetiva: '',
    valor_das: '',
    icms_st: '0',
    iss_retido: '0',
    inss_retido: '0'
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase
      .from('impostos')
      .insert([{
        competencia: formData.competencia,
        aliquota_simples_efetiva: parseFloat(formData.aliquota_simples_efetiva) || 0,
        valor_das: parseFloat(formData.valor_das) || 0,
        icms_st: parseFloat(formData.icms_st) || 0,
        iss_retido: parseFloat(formData.iss_retido) || 0,
        inss_retido: parseFloat(formData.inss_retido) || 0
      }]);

    if (error) {
      setMsgType('error');
      setMessage(`Erro ao registrar impostos: ${error.message}`);
    } else {
      setMsgType('success');
      setMessage('Tributação registrada com sucesso!');
      setFormData({ competencia: '', aliquota_simples_efetiva: '', valor_das: '', icms_st: '0', iss_retido: '0', inss_retido: '0' });
      window.dispatchEvent(new Event('impostoSalvo'));
    }
    setLoading(false);
  };

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Registro de Tributação (Simples Nacional & Retenções)</h2>
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
              <label>Competência (Mês/Ano)</label>
              <input type="month" name="competencia" className="input-field" value={formData.competencia} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Alíquota Efetiva do Simples (%)</label>
              <input type="number" step="0.01" name="aliquota_simples_efetiva" className="input-field" value={formData.aliquota_simples_efetiva} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Valor do DAS (R$)</label>
              <input type="number" step="0.01" name="valor_das" className="input-field" value={formData.valor_das} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-column">
            <div className="input-group">
              <label>ICMS ST (R$)</label>
              <input type="number" step="0.01" name="icms_st" className="input-field" value={formData.icms_st} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>ISS Retido (R$)</label>
              <input type="number" step="0.01" name="iss_retido" className="input-field" value={formData.iss_retido} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>INSS Retido (R$)</label>
              <input type="number" step="0.01" name="inss_retido" className="input-field" value={formData.inss_retido} onChange={handleChange} />
            </div>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--border-color)', margin: '2rem 0 1.5rem', borderStyle: 'solid' }} />

        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
          {loading ? 'Processando...' : 'Salvar Tributação do Mês'}
        </button>
      </form>
    </div>
  );
}