import Link from 'next/link';
import { buscarPrevisao, type PrevisaoMunicipio } from '@/lib/fontes/chuva';
import { CardChuva } from '@/components/CardChuva';

export const metadata = { title: 'Previsão de chuva — Praça Araguaia' };

export default async function Chuva() {
  let previsoes: PrevisaoMunicipio[] | null;
  try {
    previsoes = await buscarPrevisao();
  } catch {
    previsoes = null;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Voltar</Link>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">Previsão de chuva</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Próximos 7 dias na região do Araguaia — chuva, probabilidade e temperaturas.
      </p>

      {previsoes === null ? (
        <p className="mt-8 text-neutral-500">Previsão indisponível no momento. Tente mais tarde.</p>
      ) : (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {previsoes.map((p) => (
            <CardChuva key={p.municipio} previsao={p} />
          ))}
        </section>
      )}

      <p className="mt-8 text-xs text-neutral-400">fonte: Open-Meteo</p>
    </main>
  );
}
