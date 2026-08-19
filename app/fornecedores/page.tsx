import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { type Fornecedor, type CategoriaFornecedor } from '@/lib/fornecedores';
import { VitrineFornecedores } from '@/components/VitrineFornecedores';
import { ConviteDistribuicao } from '@/components/redesign/ConviteDistribuicao';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Fornecedores',
  description:
    'Ração e sal mineral, defensivos e sementes, veterinário, máquinas e peças, assistência técnica — os fornecedores da região do Araguaia, com contato direto no WhatsApp.',
};

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
    <div className="wrap">
      <section className="pghero">
        <div className="kicker">Quem atende a praça</div>
        <h1>
          Quem vende
          <br />
          <em>pra você</em>.
        </h1>
        <p className="lede">
          Agropecuárias, revendas, veterinários e oficinas da região do Araguaia. O contato é direto no WhatsApp
          — sem intermediário e sem taxa para ninguém.
        </p>
        <Link href="/fornecedores/anunciar" className="pgcta fantasma">
          Você atende a praça? Anuncie aqui →
        </Link>
      </section>

      <VitrineFornecedores fornecedores={fornecedores} />

      <ConviteDistribuicao
        alvo="fornecedores"
        titulo={['Conhece quem', 'atende bem?']}
        linha="Manda o link para a agropecuária, o veterinário ou o borracheiro de confiança — o cadastro é de graça."
      />
    </div>
  );
}
