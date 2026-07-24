import { createPublicClient } from '@/lib/supabase/public';
import { Calculadora, type Precos } from '@/components/Calculadora';
import { BalancaHero } from '@/components/redesign/BalancaHero';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Calculadora do produtor',
  description:
    'Quanto vale seu boi, seu lote de bezerro ou novilha, sua colheita e o que você tem em ouro, dólar ou cripto — com o preço da praça já preenchido.',
};

export default async function CalculadoraPage() {
  const supabase = createPublicClient();
  // Todo preço do painel entra na calculadora já preenchido — menos o Ibovespa,
  // que é índice: não se compra "um lote de pontos".
  const { data } = await supabase.from('cotacoes').select('tipo, valor');
  const precos: Precos = Object.fromEntries(
    (data ?? []).filter((c) => c.tipo !== 'ibovespa').map((c) => [c.tipo as string, Number(c.valor)]),
  );

  return (
    <div className="wrap">
      <section className="hero calchero">
        <div className="text">
          <div className="kicker">Conta de porteira</div>
          <h1>
            Quanto vale
            <br />
            <em>o seu</em>.
          </h1>
          <p className="lede">
            O boi na balança, o lote de reposição, a colheita e o que você guarda em ouro, dólar ou
            cripto. O preço da praça já vem preenchido — é só ajustar o seu.
          </p>
          <div className="meta">
            <div className="mono">Preços de hoje · fonte: painel da praça</div>
          </div>
        </div>
        <div className="cbalancabox">
          <BalancaHero />
        </div>
      </section>

      <Calculadora precos={precos} />
    </div>
  );
}
