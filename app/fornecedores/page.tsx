import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { type Fornecedor, type CategoriaFornecedor } from '@/lib/fornecedores';
import { VitrineFornecedores } from '@/components/VitrineFornecedores';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fornecedores' };

export default async function Fornecedores() {
  const { data } = await createPublicClient()
    .from('fornecedores')
    .select('nome, categoria, o_que_vende, municipio, whatsapp')
    .eq('status', 'aprovado')
    .order('nome');

  const fornecedores: Fornecedor[] = (data ?? []).map((r) => ({
    nome: r.nome as string,
    categoria: r.categoria as CategoriaFornecedor,
    oQueVende: r.o_que_vende as string,
    municipio: r.municipio as string,
    whatsapp: r.whatsapp as string,
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Quem atende a praça</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Fornecedores da praça</h1>
      <p className="mt-1 text-sm text-tinta/50">
        Agropecuárias, revendas e prestadores da região do Araguaia — fale direto no WhatsApp.
      </p>
      <Link
        href="/fornecedores/anunciar"
        className="mt-4 inline-block rounded-lg border border-linha bg-papel px-4 py-2 text-sm font-semibold text-pasto transition hover:border-pasto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
      >
        Você atende a praça? Anuncie aqui →
      </Link>
      <VitrineFornecedores fornecedores={fornecedores} />
    </main>
  );
}
