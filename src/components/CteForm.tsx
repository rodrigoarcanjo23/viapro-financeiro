import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function CteForm() {
  const [formData, setFormData] = useState({
    chave_acesso: '',
    numero_documento: '',
    cgf_emitente: '',
    razao_social_emitente: '',
    valor_total_servico: '',
    base_calculo_icms: '',
    icms_destacado: '',
    situacao: 'Autorizado'
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase
      .from('cte')
      .insert([{
        chave_acesso: formData.chave_acesso,
        numero_documento: formData.numero_documento,
        cgf_emitente: formData.cgf_emitente,
        razao_social_emitente: formData.razao_social_emitente,
        valor_total_servico: parseFloat(formData.valor_total_servico),
        base_calculo_icms: parseFloat(formData.base_calculo_icms) || 0,
        icms_destacado: parseFloat(formData.icms_destacado) || 0,
        situacao: formData.situacao
      }]);

    if (error) {
      setMsgType('error');
      setMessage(`Erro ao salvar o CTE: ${error.message}`);
    } else {
      setMsgType('success');
      setMessage('Conhecimento de Transporte (CTE) registrado com sucesso!');
      setFormData({
        chave_acesso: '', numero_documento: '', cgf_emitente: '', razao_social_emitente: '',
        valor_total_servico: '', base_calculo_icms: '', icms_destacado: '', situacao: 'Autorizado'
      });
      
      // Atualiza a lista de CTEs automaticamente
      window.dispatchEvent(new Event('cteSalvo'));
    }
    setLoading(false);
  };

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Registro de CTE (Conhecimento de Transporte Eletrônico)</h2>
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
              <label>Razão Social do Emitente (Transportadora)</label>
              <input type="text" name="razao_social_emitente" className="input-field" value={formData.razao_social_emitente} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Chave de Acesso (44 dígitos)</label>
              <input type="text" name="chave_acesso" className="input-field" value={formData.chave_acesso} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Nº Documento Fiscal</label>
              <input type="text" name="numero_documento" className="input-field" value={formData.numero_documento} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>CGF do Emitente</label>
              <input type="text" name="cgf_emitente" className="input-field" value={formData.cgf_emitente} onChange={handleChange} />
            </div>
          </div>

          <div className="form-column">
            <div className="input-group">
              <label>Valor Total do Serviço (R$)</label>
              <input type="number" step="0.01" name="valor_total_servico" className="input-field" value={formData.valor_total_servico} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Base de Cálculo ICMS (R$)</label>
              <input type="number" step="0.01" name="base_calculo_icms" className="input-field" value={formData.base_calculo_icms} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>ICMS Destacado (R$)</label>
              <input type="number" step="0.01" name="icms_destacado" className="input-field" value={formData.icms_destacado} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>Situação do Documento</label>
              <select name="situacao" className="input-field" value={formData.situacao} onChange={handleChange} required>
                <option value="Autorizado">Autorizado</option>
                <option value="Cancelado">Cancelado</option>
                <option value="Recusado">Recusado</option>
              </select>
            </div>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--border-color)', margin: '2rem 0 1.5rem', borderStyle: 'solid' }} />

        <button type="submit" disabled={loading} className="btn btn-success" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
          {loading ? 'Processando...' : 'Finalizar e Salvar CTE'}
        </button>
      </form>
    </div>
  );
}