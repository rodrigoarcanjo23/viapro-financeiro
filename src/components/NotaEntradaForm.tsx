import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';

interface ItemNota { produto: string; tipo_produto: string; valor_produto: string; }

export function NotaEntradaForm() {
  const anexoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    cnpj: '', razao_social: '', chave_acesso: '', uf: '', data_emissao: '', data_entrada: '', numero_nfe: '',
    cfop: '', valor_nfe: '', protocolo: '', situacao: 'Lançada', observacao: ''
  });
  
  const [itens, setItens] = useState<ItemNota[]>([]);
  const [gerarFaturamento, setGerarFaturamento] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [xmlLoading, setXmlLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const adicionarItem = () => setItens([...itens, { produto: '', tipo_produto: 'Consumo', valor_produto: '' }]);
  const removerItem = (index: number) => setItens(itens.filter((_, i) => i !== index));
  const handleItemChange = (index: number, campo: keyof ItemNota, valor: string) => {
    const novosItens = [...itens]; novosItens[index][campo] = valor; setItens(novosItens);
  };

  const handleRemoverAnexo = () => {
    setSelectedFile(null);
    setFileName('');
    if (anexoInputRef.current) anexoInputRef.current.value = '';
  };

  const handleImportarXML = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setXmlLoading(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const xmlText = event.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        const cnpj = xmlDoc.getElementsByTagName("CNPJ")[0]?.textContent || "";
        const razao = xmlDoc.getElementsByTagName("xNome")[0]?.textContent || "";
        const numero = xmlDoc.getElementsByTagName("nNF")[0]?.textContent || "";
        const uf = xmlDoc.getElementsByTagName("UF")[0]?.textContent || "";
        const cfop = xmlDoc.getElementsByTagName("CFOP")[0]?.textContent || "";
        const valor = xmlDoc.getElementsByTagName("vNF")[0]?.textContent || "";
        const protocolo = xmlDoc.getElementsByTagName("nProt")[0]?.textContent || "";
        
        let chave = xmlDoc.getElementsByTagName("chNFe")[0]?.textContent || "";
        if (!chave) {
          const infNFe = xmlDoc.getElementsByTagName("infNFe")[0];
          chave = infNFe?.getAttribute("Id")?.replace("NFe", "") || "";
        }

        let emissao = xmlDoc.getElementsByTagName("dhEmi")[0]?.textContent || xmlDoc.getElementsByTagName("dEmi")[0]?.textContent || "";
        if (emissao) emissao = emissao.substring(0, 10);

        setFormData(prev => ({
          ...prev, cnpj, razao_social: razao, numero_nfe: numero, uf, cfop, valor_nfe: valor, protocolo, chave_acesso: chave, data_emissao: emissao, data_entrada: emissao
        }));

        const prodElements = xmlDoc.getElementsByTagName("det");
        const itensCarregados: ItemNota[] = [];
        for (let i = 0; i < prodElements.length; i++) {
          const p = prodElements[i].getElementsByTagName("prod")[0];
          const descricao = p?.getElementsByTagName("xProd")[0]?.textContent || "Produto sem descrição";
          const vProd = p?.getElementsByTagName("vUnCom")[0]?.textContent || "0";
          itensCarregados.push({ produto: descricao, tipo_produto: 'Consumo', valor_produto: parseFloat(vProd).toFixed(2) });
        }
        
        setItens(itensCarregados);
        Swal.fire('XML Processado!', 'Os dados foram preenchidos com sucesso.', 'success');
      } catch (err) {
        Swal.fire('Erro no XML', 'Falha ao ler a estrutura do arquivo. Verifique o documento.', 'error');
      } finally {
        setXmlLoading(false);
      }
    };
    reader.readAsText(arquivo);
    e.target.value = ''; 
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. VERIFICAÇÃO ANTI-DUPLICIDADE DE ALTA PERFORMANCE
    const { data: notaDuplicada } = await supabase
      .from('notas_entrada')
      .select('id')
      .eq('chave_acesso', formData.chave_acesso)
      .maybeSingle();

    if (notaDuplicada) {
      Swal.fire({
        icon: 'warning',
        title: 'Nota Já Registrada!',
        text: `A NF-e com a chave terminada em "...${formData.chave_acesso.slice(-4)}" já consta no sistema. Não é possível cadastrá-la em duplicidade.`,
        confirmButtonColor: '#1e40af'
      });
      setLoading(false);
      return;
    }

    // 2. CONTINUA O FLUXO NORMAL
    const { data: { user } } = await supabase.auth.getUser();
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '');
    const valorNfeFloat = parseFloat(formData.valor_nfe) || 0;
    let urlArquivoFinal = '';

    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop();
      const fileNameUpload = `${Date.now()}_nota.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('documentos').upload(fileNameUpload, selectedFile);
      if (uploadError) {
        Swal.fire('Erro no Anexo', uploadError.message, 'error');
        setLoading(false); return;
      }
      const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(fileNameUpload);
      urlArquivoFinal = publicUrlData.publicUrl;
    }

    const { data: notaData, error: notaError } = await supabase
      .from('notas_entrada')
      .insert([{
        cnpj: cnpjLimpo, razao_social: formData.razao_social, chave_acesso: formData.chave_acesso, uf: formData.uf,
        data_emissao: formData.data_emissao, data_entrada: formData.data_entrada, numero_nfe: formData.numero_nfe, cfop: formData.cfop,
        valor_nfe: valorNfeFloat, protocolo: formData.protocolo, situacao: formData.situacao, observacao: formData.observacao,
        arquivo_url: urlArquivoFinal
      }])
      .select('id').single();

    if (notaError) {
      Swal.fire('Erro', notaError.message, 'error'); setLoading(false); return;
    }

    if (notaData && itens.length > 0) {
      const itensFormatados = itens.map(item => ({
        nota_entrada_id: notaData.id, produto: item.produto, tipo_produto: item.tipo_produto, valor_produto: parseFloat(item.valor_produto) || 0
      }));
      await supabase.from('itens_nota_entrada').insert(itensFormatados);
    }

    if (notaData && gerarFaturamento) {
      await supabase.from('faturamento').insert([{
        tipo: 'A Pagar', status: 'Pendente', data_vencimento: formData.data_entrada,
        valor_bruto: valorNfeFloat, descontos: 0, acrescimos: 0, valor_liquido: valorNfeFloat, nota_entrada_id: notaData.id
      }]);
    }

    await supabase.from('logs_auditoria').insert([{
      usuario: user?.email || 'Sistema', acao: 'Criação de Registro', tabela: 'notas_entrada',
      registro_id: notaData.id, detalhes: `Lançamento da NF-e nº ${formData.numero_nfe} do Fornecedor ${formData.razao_social}`
    }]);

    Swal.fire('Sucesso!', 'Nota Fiscal lançada e auditada sem duplicidades.', 'success');
    
    setFormData({ cnpj: '', razao_social: '', chave_acesso: '', uf: '', data_emissao: '', data_entrada: '', numero_nfe: '', cfop: '', valor_nfe: '', protocolo: '', situacao: 'Lançada', observacao: '' });
    setItens([]);
    setGerarFaturamento(false);
    handleRemoverAnexo();
    setLoading(false);
    
    window.dispatchEvent(new Event('notaEntradaSalva'));
    window.dispatchEvent(new Event('faturamentoSalvo'));
  };

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Registro Avançado de Nota de Entrada</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label className="btn btn-primary" style={{ fontSize: '0.85rem', gap: '0.5rem', cursor: 'pointer' }}>
            {xmlLoading ? 'Lendo...' : '📁 Importar XML da Nota'}
            <input type="file" accept=".xml" style={{ display: 'none' }} onChange={handleImportarXML} />
          </label>
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-column">
            <div className="input-group">
              <label>CNPJ do Emitente</label>
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
            <div className="input-group">
              <label>Protocolo</label>
              <input type="text" name="protocolo" className="input-field" value={formData.protocolo} onChange={handleChange} />
            </div>
          </div>

          <div className="form-column">
            <div className="input-group">
              <label>Data de Emissão</label>
              <input type="date" name="data_emissao" className="input-field" value={formData.data_emissao} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Data de Entrada</label>
              <input type="date" name="data_entrada" className="input-field" value={formData.data_entrada} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Nº NF-e</label>
              <input type="text" name="numero_nfe" className="input-field" value={formData.numero_nfe} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>CFOP</label>
              <input type="text" name="cfop" className="input-field" value={formData.cfop} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>Valor Total NF-e (R$)</label>
              <input type="number" step="0.01" name="valor_nfe" className="input-field" value={formData.valor_nfe} onChange={handleChange} required />
            </div>
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: '1.5rem' }}>
          <div className="form-column" style={{ gridColumn: 'span 1' }}>
            <div className="input-group">
              <label>Situação da Nota</label>
              <select name="situacao" className="input-field" value={formData.situacao} onChange={handleChange} required>
                <option value="Lançada">Lançada</option>
                <option value="Pendente">Pendente</option>
                <option value="Cancelada">Cancelada</option>
                <option value="Devolvida">Devolvida</option>
              </select>
            </div>
            
            <div className="input-group" style={{ marginTop: '0.5rem' }}>
              <label>Anexar Nota Fiscal / Comprovante</label>
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
          
          <div className="form-column" style={{ gridColumn: 'span 2' }}>
            <div className="input-group">
              <label>Observações Adicionais</label>
              <textarea name="observacao" className="input-field" value={formData.observacao} onChange={handleChange} rows={5} placeholder="Notas adicionais..." style={{ resize: 'vertical' }} />
            </div>
          </div>
        </div>

        <div className="card-header" style={{ marginTop: '2.5rem' }}>
          <h2>Itens e Produtos</h2>
          <button type="button" onClick={adicionarItem} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>+ Adicionar Produto</button>
        </div>
        
        {itens.map((item, index) => (
          <div key={index} className="item-row">
            <div className="input-group">
              <label>Descrição do Produto</label>
              <input type="text" className="input-field" value={item.produto} onChange={(e) => handleItemChange(index, 'produto', e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Tipo de Uso</label>
              <select className="input-field" value={item.tipo_produto} onChange={(e) => handleItemChange(index, 'tipo_produto', e.target.value)}>
                <option value="Consumo">Consumo</option>
                <option value="Amostra">Amostra</option>
                <option value="Imobilizado">Imobilizado</option>
              </select>
            </div>
            <div className="input-group">
              <label>Valor (R$)</label>
              <input type="number" step="0.01" className="input-field" value={item.valor_produto} onChange={(e) => handleItemChange(index, 'valor_produto', e.target.value)} />
            </div>
            <button type="button" onClick={() => removerItem(index)} className="btn btn-danger" title="Remover Produto">X</button>
          </div>
        ))}

        <hr style={{ borderColor: 'var(--border-color)', margin: '1.5rem 0', borderStyle: 'solid' }} />

        <div className="automation-box">
          <input type="checkbox" id="chkAutomação" checked={gerarFaturamento} onChange={(e) => setGerarFaturamento(e.target.checked)} />
          <label htmlFor="chkAutomação">Gerar título "A Pagar" automaticamente no módulo de Faturamento com o valor desta Nota</label>
        </div>

        <button type="submit" disabled={loading} className="btn btn-success" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '1.5rem' }}>
          {loading ? 'Processando...' : 'Finalizar e Salvar'}
        </button>
      </form>
    </div>
  );
}