import Link from 'next/link';
import { FormReporte } from '@/components/FormReporte';

export const metadata = { title: 'Reportar preço — Praça Araguaia' };

export default function Reportar() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Link href="/termometro" className="text-sm text-tinta/50 hover:underline">← Voltar</Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Sem cadastro · anônimo</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Qual o preço na sua praça?</h1>
      <p className="mt-1 text-sm text-tinta/50">Seu reporte é conferido antes de entrar na média da região.</p>

      <div className="mt-6">
        <FormReporte />
      </div>
    </main>
  );
}
