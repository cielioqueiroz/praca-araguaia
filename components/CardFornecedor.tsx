import { linkWhatsApp, type Fornecedor } from '@/lib/fornecedores';

export function CardFornecedor({ fornecedor }: { fornecedor: Fornecedor }) {
  return (
    <div className="flex flex-col rounded-xl border border-linha bg-papel p-5 shadow-[0_1px_2px_rgba(28,38,32,0.05)]">
      <h3 className="font-display text-lg font-bold tracking-tight text-mata">{fornecedor.nome}</h3>
      <p className="mt-1 text-sm text-tinta/70">{fornecedor.oQueVende}</p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-pasto">{fornecedor.municipio}</p>
      <a
        href={linkWhatsApp(fornecedor.whatsapp)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-pasto px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-mata focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pasto"
      >
        Chamar no WhatsApp
      </a>
    </div>
  );
}
