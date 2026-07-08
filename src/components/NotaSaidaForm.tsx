import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function NotaSaidaForm() {
  const [formData, setFormData] = useState({
    cnpj: '', razao_social: '', chave_acesso: '', 
    uf: '', data_emissao: '', numero_nfe: '', valor_nfe: ''
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

    const cnpjLimpo = formData.cnpj.replace(/\D/g, '');

    const { error } = await supabase
      .from('notas_saida')
      .insert([{
        cnpj: cnpjLimpo, 
        razao_social: formData.razao_social,
        chave_acesso: formData.chave_acesso, 
        uf: formData.uf,
        data_emissao: formData.data_emissao, 
        numero_nfe: formData.numero_nfe, 
        valor_nfe: parseFloat(formData.valor_nfe)
      }]);

    if (error) {
      setMsgType('error');
      setMessage(`Erro ao salvar a nota de saída: ${error.message}`);
    } else {
      setMsgType('success');
      setMessage('Nota de Saída registrada com sucesso!');
      setFormData({ cnpj: '', razao_social: '', chave_acesso: '', uf: '', data_emissao: '', numero_nfe: '', valor_nfe: '' });
      
      // Dispara um evento customizado para a lista se atualizar sozinha
      window.dispatchEvent(new Event('notaSaidaSalva'));
    }
    setLoading(false);
  };

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Registro de Nota de Saída (Faturamento)</h2>
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
              <label>CNPJ do Cliente</label>
              <input type="text" name="cnpj" className="input-field" value={formData.cnpj} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Razão Social</label>
              <input type="text" name="razao_social" className="input-field" value={formData.razao_social} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Chave de Acesso (44 dígitos)</label>
              <input type="text" name="chave_acesso" className="input-field" value={formData.chave_acesso} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>UF</label>
              <input type="text" name="uf" className="input-field" value={formData.uf} onChange={handleChange} required maxLength={2} />
            </div>
          </div>

          <div className="form-column">
            <div className="input-group">
              <label>Data de Emissão</label>
              <input type="date" name="data_emissao" className="input-field" value={formData.data_emissao} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Nº NF-e</label>
              <input type="text" name="numero_nfe" className="input-field" value={formData.numero_nfe} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Valor Total da NF-e (R$)</label>
              <input type="number" step="0.01" name="valor_nfe" className="input-field" value={formData.valor_nfe} onChange={handleChange} required />
            </div>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--border-color)', margin: '2rem 0 1.5rem', borderStyle: 'solid' }} />

        <button type="submit" disabled={loading} className="btn btn-success" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
          {loading ? 'Processando...' : 'Finalizar e Salvar Nota de Saída'}
        </button>
      </form>
    </div>
  );
}