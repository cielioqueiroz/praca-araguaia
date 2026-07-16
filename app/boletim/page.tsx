import Link from 'next/link';

export const metadata = { title: 'Boletim do dia' };

export default function Boletim() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/cotacoes" className="text-sm text-tinta/50 hover:underline">← Voltar</Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Para compartilhar</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Boletim do dia</h1>
      <p className="mt-1 text-sm text-tinta/50">Baixe a imagem e compartilhe no Instagram ou WhatsApp.</p>

      {/* Imagem dinâmica gerada pela rota; next/image não otimiza rota própria. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/boletim"
        alt="Boletim do dia com as cotações da Praça Araguaia"
        className="mt-6 w-full max-w-xl rounded-xl border border-linha shadow-sm"
      />

      <a
        href="/api/boletim"
        download="boletim-praca-araguaia.png"
        className="mt-5 inline-block rounded-lg bg-pasto px-4 py-2 text-sm font-semibold text-white transition hover:bg-mata focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
      >
        Baixar imagem
      </a>
    </main>
  );
}
