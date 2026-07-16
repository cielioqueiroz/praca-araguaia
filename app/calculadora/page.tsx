import { createPublicClient } from '@/lib/supabase/public';
import { Calculadora, type Precos } from '@/components/Calculadora';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Calculadora' };

export default async function CalculadoraPage() {
  const supabase = createPublicClient();
  // Todo preço do painel entra na calculadora já preenchido — menos o Ibovespa,
  // que é índice: não se compra "um lote de pontos".
  const { data } = await supabase.from('cotacoes').select('tipo, valor');
  const precos: Precos = Object.fromEntries(
    (data ?? []).filter((c) => c.tipo !== 'ibovespa').map((c) => [c.tipo as string, Number(c.valor)]),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Conta de porteira</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Calculadora do produtor</h1>
      <p className="mt-1 text-sm text-tinta/50">
        Quanto vale seu gado, seu lote de bezerro, sua colheita e o que você tem em ouro, dólar ou
        cripto — com o preço da praça já preenchido, é só ajustar.
      </p>
      <Calculadora precos={precos} />
    </main>
  );
}
