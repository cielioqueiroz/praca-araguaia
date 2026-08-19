import Link from 'next/link';
import { FormAnuncioFornecedor } from '@/components/FormAnuncioFornecedor';

export const metadata = {
  title: 'Anunciar nos fornecedores',
  description:
    'Cadastre sua agropecuária, revenda ou serviço na vitrine da Praça Araguaia e receba contato direto do produtor no WhatsApp. De graça.',
};

export default function Anunciar() {
  return (
    <div className="wrap">
      <Link href="/fornecedores" className="pgvolta">
        ← Fornecedores
      </Link>

      <section className="pghero">
        <div className="kicker">Quem atende a praça</div>
        <h1>
          Anuncie na
          <br />
          <em>praça</em>.
        </h1>
        <p className="lede">
          O produtor chega até você pelo WhatsApp, sem intermediário e sem custo. Entra na vitrine depois de uma
          conferência rápida.
        </p>
      </section>

      <div className="pgcard estreito">
        <FormAnuncioFornecedor />
      </div>

      <p className="cidnota">
        O contato que você cadastrar aparece publicamente na vitrine — é ele que o produtor usa para falar com
        você. Nada além disso é exibido.
      </p>
    </div>
  );
}
