import { Suspense } from 'react';
import Link from 'next/link';
import { FormReporte } from '@/components/FormReporte';

export const metadata = {
  title: 'Reportar preço',
  description:
    'Diga quanto você recebeu pelo boi, bezerro, novilha, vaca, soja ou milho na sua cidade do Araguaia. Anônimo, sem cadastro, um minuto.',
};

export default function Reportar() {
  return (
    <div className="wrap">
      <Link href="/termometro" className="pgvolta">
        ← Termômetro da Praça
      </Link>

      <section className="pghero">
        <div className="kicker">Sem cadastro · anônimo</div>
        <h1>
          Quanto você
          <br />
          <em>pegou</em>?
        </h1>
        <p className="lede">
          O preço que você fez vira a referência do vizinho. É conferido antes de entrar na conta e ninguém fica
          sabendo quem contou.
        </p>
      </section>

      {/* O formulário lê ?produto= da URL (useSearchParams) — o Next exige a fronteira
          de Suspense para não desistir da renderização estática da página inteira. */}
      <div className="pgcard estreito">
        <Suspense fallback={<div style={{ height: 320 }} />}>
          <FormReporte />
        </Suspense>
      </div>

      <p className="cidnota">
        Não pedimos nome, telefone nem e-mail — o reporte é anônimo de verdade. O que sai na tela é o valor
        típico da cidade, nunca um preço ligado a uma pessoa.
      </p>
    </div>
  );
}
