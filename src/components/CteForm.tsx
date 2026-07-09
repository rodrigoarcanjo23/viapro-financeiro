import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';

export function CteForm() {
  const anexoInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    chave_acesso: '', numero_documento: '', cgf_emitente: '', razao_social_emitente: '',
    data_emissao: '', valor_total_servico: '', base_calculo_icms: '', icms_destacado: '', situacao: 'Autorizado'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // VERIFICAÇÃO ANTI-DUPLICIDADE
    const { data: cteDuplicado } = await supabase
      .from('cte')
      .select('id')
      .eq('chave_acesso', formData.chave_acesso)
      .maybeSingle();

    if (cteDuplicado) {
      Swal.fire({
        icon: 'warning',
        title: 'CTE Já Registrado!',
        text: `Este Conhecimento de Transporte (Chave final "...${formData.chave_acesso.slice(-4)}") já existe no banco de dados.`,
        confirmButtonColor: '#1e40af'
      });
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    let urlArquivoFinal = '';

    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop();
      const fileNameUpload = `cte_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('documentos').upload(fileNameUpload, selectedFile);
      if (uploadError) {
        Swal.fire('Erro no Anexo', uploadError.message, 'error');
        setLoading(false); return;
      }
      const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(fileNameUpload);
      urlArquivoFinal = publicUrlData.publicUrl;
    }

    const { data: cteData, error } = await supabase
      .from('cte')
      .insert([{
        chave_acesso: formData.chave_acesso, numero_documento: formData.numero_documento, cgf_emitente: formData.cgf_emitente,
        razao_social_emitente: formData.razao_social_emitente, data_emissao: formData.data_emissao,
        valor_total_servico: parseFloat(formData.valor_total_servico), base_calculo_icms: parseFloat(formData.base_calculo_icms) || 0,
        icms_destacado: parseFloat(formData.icms_destacado) || 0, situacao: formData.situacao, arquivo_url: urlArquivoFinal
      }])
      .select('id').single();

    if (error) {
      Swal.fire('Erro', error.message, 'error');
    } else {
      await supabase.from('logs_auditoria').insert([{
        usuario: user?.email || 'Sistema', acao: 'Criação de Registro', tabela: 'cte',
        registro_id: cteData?.id, detalhes: `Lançamento do CTE nº ${formData.numero_documento}`
      }]);

      Swal.fire('Sucesso!', 'CTE salvo com segurança!', 'success');
      
      setFormData({ chave_acesso: '', numero_documento: '', cgf_emitente: '', razao_social_emitente: '', data_emissao: '', valor_total_servico: '', base_calculo_icms: '', icms_destacado: '', situacao: 'Autorizado' });
      handleRemoverAnexo();
      window.dispatchEvent(new Event('cteSalvo'));
    }
    setLoading(false);
  };

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Registro de CTE (Conhecimento de Transporte Eletrônico)</h2>
      </div>

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
              <label>Data de Emissão</label>
              <input type="date" name="data_emissao" className="input-field" value={formData.data_emissao} onChange={handleChange} required />
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
            
            <div className="input-group" style={{ marginTop: '0.5rem' }}>
              <label>Anexar XML ou PDF do CTE</label>
              <input type="file" className="input-field" ref={anexoInputRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if(file) { setSelectedFile(file); setFileName(file.name); }
              }} />
              
              {fileName && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.8rem', padding: '0.6rem 1rem', backgroundColor: '#f8fafc', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{fontSize: '0.85rem', color: 'var(--viapro-green)', fontWeight: '600'}}>📎 {fileName}</span>
                  <button type="button" onClick={handleRemoverAnexo} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>✖ Remover</button>
                </div>
              )}
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