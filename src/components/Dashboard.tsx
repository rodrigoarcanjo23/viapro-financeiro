import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    receitasPagas: 0,
    despesasPagas: 0,
    saldoReal: 0,
    receitasPendentes: 0,
    despesasPendentes: 0
  });

  const carregarDados = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('faturamento').select('tipo, status, valor_liquido');
    
    if (error) {
      console.error("Erro ao carregar dashboard:", error);
      setLoading(false);
      return;
    }

    let recPagas = 0, despPagas = 0, recPend = 0, despPend = 0;

    data?.forEach(titulo => {
      const valor = parseFloat(titulo.valor_liquido);
      if (titulo.tipo === 'A Receber') {
        if (titulo.status === 'Pago') recPagas += valor;
        if (titulo.status === 'Pendente' || titulo.status === 'Atrasado') recPend += valor;
      } else if (titulo.tipo === 'A Pagar') {
        if (titulo.status === 'Pago') despPagas += valor;
        if (titulo.status === 'Pendente' || titulo.status === 'Atrasado') despPend += valor;
      }
    });

    setMetrics({
      receitasPagas: recPagas,
      despesasPagas: despPagas,
      saldoReal: recPagas - despPagas,
      receitasPendentes: recPend,
      despesasPendentes: despPend
    });
    setLoading(false);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '1.5rem' }}>
        <h2>Visão Geral Financeira</h2>
        <button onClick={carregarDados} className="btn btn-primary btn-sm">Atualizar Painel</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Calculando indicadores...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          
          {/* Card Saldo Atual */}
          <div className="premium-card" style={{ borderLeft: '5px solid var(--viapro-blue)', margin: 0, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Saldo Real (Recebido - Pago)</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: metrics.saldoReal >= 0 ? 'var(--viapro-blue)' : '#ef4444', margin: 0 }}>
              {formatarMoeda(metrics.saldoReal)}
            </p>
          </div>

          {/* Card Receitas Recebidas */}
          <div className="premium-card" style={{ borderLeft: '5px solid var(--viapro-green)', margin: 0, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Receitas (Pagas)</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--viapro-green)', margin: 0 }}>
              {formatarMoeda(metrics.receitasPagas)}
            </p>
            <p style={{ fontSize: '0.85rem', color: '#f59e0b', marginTop: '0.5rem', fontWeight: '600' }}>
              A Receber (Pendentes): {formatarMoeda(metrics.receitasPendentes)}
            </p>
          </div>

          {/* Card Despesas Pagas */}
          <div className="premium-card" style={{ borderLeft: '5px solid #ef4444', margin: 0, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Despesas (Pagas)</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444', margin: 0 }}>
              {formatarMoeda(metrics.despesasPagas)}
            </p>
            <p style={{ fontSize: '0.85rem', color: '#f59e0b', marginTop: '0.5rem', fontWeight: '600' }}>
              A Pagar (Pendentes): {formatarMoeda(metrics.despesasPendentes)}
            </p>
          </div>

        </div>
      )}
    </div>
  );
}