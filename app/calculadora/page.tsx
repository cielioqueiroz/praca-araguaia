import { createPublicClient } from '@/lib/supabase/public';
import { Calculadora } from '@/components/Calculadora';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Calculadora — Praça Araguaia' };

export default async function CalculadoraPage() {
  const supabase = createPublicClient();
  const { data } = await supabase.from('cotacoes').select('tipo, valor').in('tipo', ['boi', 'soja', 'milho']);
  const mapa = new Map((data ?? []).map((c) => [c.tipo as string, Number(c.valor)]));
  const precos = { boi: mapa.get('boi'), soja: mapa.get('soja'), milho: mapa.get('milho') };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Conta de porteira</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Calculadora do produtor</h1>
      <p className="mt-1 text-sm text-tinta/50">
        Quanto vale seu lote de boi e sua colheita — com o preço da praça já preenchido, é só ajustar.
      </p>
      <Calculadora precos={precos} />
    </main>
  );
}
