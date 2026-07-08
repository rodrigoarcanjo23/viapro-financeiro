import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ItemNota {
  produto: string;
  tipo_produto: string;
  valor_produto: string;
}

export function NotaEntradaForm() {
  const [formData, setFormData] = useState({
    cnpj: '', razao_social: '', chave_acesso: '', uf: '',
    data_emissao: '', data_entrada: '', numero_nfe: '',
    cfop: '', valor_nfe: '', protocolo: '',
    situacao: 'Lançada', observacao: ''
  });
  
  const [itens, setItens] = useState<ItemNota[]>([]);
  const [gerarFaturamento, setGerarFaturamento] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const adicionarItem = () => {
    setItens([...itens, { produto: '', tipo_produto: 'Consumo', valor_produto: '' }]);
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, campo: keyof ItemNota, valor: string) => {
    const novosItens = [...itens];
    novosItens[index][campo] = valor;
    setItens(novosItens);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const cnpjLimpo = formData.cnpj.replace(/\D/g, '');
    const valorNfeFloat = parseFloat(formData.valor_nfe) || 0;

    const { data: notaData, error: notaError } = await supabase
      .from('notas_entrada')
      .insert([{
        cnpj: cnpjLimpo, razao_social: formData.razao_social,
        chave_acesso: formData.chave_acesso, uf: formData.uf,
        data_emissao: formData.data_emissao, data_entrada: formData.data_entrada,
        numero_nfe: formData.numero_nfe, cfop: formData.cfop,
        valor_nfe: valorNfeFloat, protocolo: formData.protocolo,
        situacao: formData.situacao, observacao: formData.observacao
      }])
      .select('id').single();

    if (notaError) {
      setMsgType('error');
      setMessage(`Erro ao salvar a nota: ${notaError.message}`);
      setLoading(false);
      return;
    }

    if (notaData && itens.length > 0) {
      const itensFormatados = itens.map(item => ({
        nota_entrada_id: notaData.id, produto: item.produto,
        tipo_produto: item.tipo_produto, valor_produto: parseFloat(item.valor_produto) || 0
      }));

      const { error: itensError } = await supabase.from('itens_nota_entrada').insert(itensFormatados);
      if (itensError) {
        setMsgType('error');
        setMessage(`Nota salva, mas erro nos itens: ${itensError.message}`);
        setLoading(false);
        return;
      }
    }

    if (notaData && gerarFaturamento) {
      const { error: fatError } = await supabase.from('faturamento').insert([{
        tipo: 'A Pagar',
        status: 'Pendente',
        data_vencimento: formData.data_entrada,
        valor_bruto: valorNfeFloat,
        descontos: 0,
        acrescimos: 0,
        valor_liquido: valorNfeFloat,
        nota_entrada_id: notaData.id
      }]);

      if (fatError) {
        setMsgType('error');
        setMessage(`Nota salva, mas falha ao gerar título financeiro: ${fatError.message}`);
        setLoading(false);
        return;
      }
    }

    setMsgType('success');
    setMessage(gerarFaturamento ? 'Nota de Entrada e Título a Pagar registrados com sucesso!' : 'Nota de Entrada salva com sucesso!');
    setFormData({ 
      cnpj: '', razao_social: '', chave_acesso: '', uf: '', data_emissao: '', 
      data_entrada: '', numero_nfe: '', cfop: '', valor_nfe: '', protocolo: '',
      situacao: 'Lançada', observacao: '' 
    });
    setItens([]);
    setGerarFaturamento(false);
    setLoading(false);
    
    // Dispara eventos para atualizar as listas instantaneamente!
    window.dispatchEvent(new Event('notaEntradaSalva'));
    window.dispatchEvent(new Event('faturamentoSalvo'));
  };

  return (
    <div className="premium-card">
      <div className="card-header">
        <h2>Registro de Nota de Entrada</h2>
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
          </div>
          <div className="form-column" style={{ gridColumn: 'span 2' }}>
            <div className="input-group">
              <label>Observações Adicionais</label>
              <textarea 
                name="observacao" 
                className="input-field" 
                value={formData.observacao} 
                onChange={handleChange} 
                rows={3}
                placeholder="Detalhes sobre frete, divergências, quem recebeu..." 
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        <div className="card-header" style={{ marginTop: '2.5rem' }}>
          <h2>Itens e Produtos</h2>
          <button type="button" onClick={adicionarItem} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
            + Adicionar Produto
          </button>
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
              {/* O atributo 'required' foi removido deste input */}
              <input type="number" step="0.01" className="input-field" value={item.valor_produto} onChange={(e) => handleItemChange(index, 'valor_produto', e.target.value)} />
            </div>
            <button type="button" onClick={() => removerItem(index)} className="btn btn-danger" title="Remover Produto">X</button>
          </div>
        ))}

        <hr style={{ borderColor: 'var(--border-color)', margin: '1.5rem 0', borderStyle: 'solid' }} />

        <div className="automation-box">
          <input 
            type="checkbox" 
            id="chkAutomação"
            checked={gerarFaturamento}
            onChange={(e) => setGerarFaturamento(e.target.checked)}
          />
          <label htmlFor="chkAutomação">Gerar título "A Pagar" automaticamente no módulo de Faturamento com o valor desta Nota</label>
        </div>

        <button type="submit" disabled={loading} className="btn btn-success" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '1.5rem' }}>
          {loading ? 'Processando...' : 'Finalizar e Salvar'}
        </button>
      </form>
    </div>
  );
}