import Link from 'next/link';
import { buscarPrevisao, type PrevisaoMunicipio } from '@/lib/fontes/chuva';
import { CardChuva } from '@/components/CardChuva';

export const metadata = { title: 'Previsão de chuva — Praça Araguaia' };

// Dinâmica de propósito: o fetch da Open-Meteo continua cacheado por 1h (data cache),
// mas uma FALHA não fica congelada na página estática — a próxima visita tenta de novo
// e a página se recupera assim que a API voltar (falha de fetch não entra no cache).
export const dynamic = 'force-dynamic';

export default async function Chuva() {
  let previsoes: PrevisaoMunicipio[] | null;
  try {
    previsoes = await buscarPrevisao();
  } catch (erro) {
    console.error('Previsão indisponível (Open-Meteo):', erro);
    previsoes = null;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-tinta/50 hover:underline">← Voltar</Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-rio">Próximos 7 dias · Open-Meteo</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Chuva na região</h1>
      <p className="mt-1 text-sm text-tinta/50">
        Chuva, probabilidade e temperaturas por município do Araguaia.
      </p>

      {previsoes === null ? (
        <p className="mt-8 text-tinta/50">Previsão indisponível no momento. Tente mais tarde.</p>
      ) : (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {previsoes.map((p) => (
            <CardChuva key={p.municipio} previsao={p} />
          ))}
        </section>
      )}
    </main>
  );
}
