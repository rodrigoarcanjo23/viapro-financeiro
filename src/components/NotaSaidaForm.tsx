import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';

export function NotaSaidaForm() {
  const anexoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    cnpj: '', razao_social: '', chave_acesso: '', uf: '', data_emissao: '', numero_nfe: '', valor_nfe: ''
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [gerarFaturamento, setGerarFaturamento] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    const { data: notaDuplicada } = await supabase
      .from('notas_saida')
      .select('id')
      .eq('chave_acesso', formData.chave_acesso)
      .maybeSingle();

    if (notaDuplicada) {
      Swal.fire({
        icon: 'warning',
        title: 'Nota Já Registrada!',
        text: `A NF-e de Saída com a chave terminada em "...${formData.chave_acesso.slice(-4)}" já consta no sistema.`,
        confirmButtonColor: '#1e40af'
      });
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '');
    const valorNfeFloat = parseFloat(formData.valor_nfe) || 0;
    let urlArquivoFinal = '';

    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop();
      const fileNameUpload = `saida_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('documentos').upload(fileNameUpload, selectedFile);
      if (uploadError) {
        Swal.fire('Erro no Anexo', uploadError.message, 'error');
        setLoading(false); return;
      }
      const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(fileNameUpload);
      urlArquivoFinal = publicUrlData.publicUrl;
    }

    const { data: notaData, error } = await supabase
      .from('notas_saida')
      .insert([{
        cnpj: cnpjLimpo, razao_social: formData.razao_social, chave_acesso: formData.chave_acesso, uf: formData.uf,
        data_emissao: formData.data_emissao, numero_nfe: formData.numero_nfe, valor_nfe: valorNfeFloat, arquivo_url: urlArquivoFinal
      }])
      .select('id').single();

    if (error) {
      Swal.fire('Erro', error.message, 'error');
    } else {
      if (notaData && gerarFaturamento) {
        await supabase.from('faturamento').insert([{
          tipo: 'A Receber', status: 'Pendente', data_vencimento: formData.data_emissao,
          valor_bruto: valorNfeFloat, descontos: 0, acrescimos: 0, valor_liquido: valorNfeFloat
        }]);
      }

      await supabase.from('logs_auditoria').insert([{
        usuario: user?.email || 'Sistema', acao: 'Criação de Registro', tabela: 'notas_saida',
        registro_id: notaData?.id, detalhes: `Lançamento da NF-e de Saída nº ${formData.numero_nfe}`
      }]);

      Swal.fire('Sucesso!', 'Nota de Saída salva sem duplicidades!', 'success');
      
      setFormData({ cnpj: '', razao_social: '', chave_acesso: '', uf: '', data_emissao: '', numero_nfe: '', valor_nfe: '' });
      setGerarFaturamento(false);
      handleRemoverAnexo();
      
      window.dispatchEvent(new Event('notaSaidaSalva'));
      if (gerarFaturamento) window.dispatchEvent(new Event('faturamentoSalvo'));
    }
    setLoading(false);
  };

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Registro de Nota de Saída (Faturamento)</h2>
      </div>

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
            
            <div className="input-group" style={{ marginTop: '0.5rem' }}>
              <label>Anexar XML ou PDF da Nota</label>
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

        <hr style={{ borderColor: 'var(--border-color)', margin: '1.5rem 0', borderStyle: 'solid' }} />

        <div className="automation-box">
          <input type="checkbox" id="chkAutomacaoSaida" checked={gerarFaturamento} onChange={(e) => setGerarFaturamento(e.target.checked)} />
          <label htmlFor="chkAutomacaoSaida">Gerar automaticamente um título "A Receber" no módulo de Faturamento</label>
        </div>

        <button type="submit" disabled={loading} className="btn btn-success" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '1.5rem' }}>
          {loading ? 'Processando...' : 'Finalizar e Salvar Nota de Saída'}
        </button>
      </form>
    </div>
  );
}