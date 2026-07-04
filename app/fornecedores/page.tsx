import { FORNECEDORES } from '@/lib/fornecedores';
import { VitrineFornecedores } from '@/components/VitrineFornecedores';

export const metadata = { title: 'Fornecedores — Praça Araguaia' };

export default function Fornecedores() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Quem atende a praça</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Fornecedores da praça</h1>
      <p className="mt-1 text-sm text-tinta/50">
        Agropecuárias, revendas e prestadores da região do Araguaia — fale direto no WhatsApp.
      </p>
      <VitrineFornecedores fornecedores={FORNECEDORES} />
    </main>
  );
}
