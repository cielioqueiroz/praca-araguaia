import { linkWhatsApp, type Fornecedor } from '@/lib/fornecedores';

// Mesma gramática dos outros cartões do site: nome em serifa, o que vende em corpo,
// cidade em mono. O botão verde é a única cor forte — é a ação que o card existe para
// provocar.
export function CardFornecedor({ fornecedor }: { fornecedor: Fornecedor }) {
  return (
    <div className="fcard">
      <h3>{fornecedor.nome}</h3>
      <p className="fvende">{fornecedor.oQueVende}</p>
      <p className="fcidade mono">{fornecedor.municipio}</p>
      <a
        href={linkWhatsApp(fornecedor.whatsapp)}
        target="_blank"
        rel="noopener noreferrer"
        className="fzap"
      >
        Chamar no WhatsApp
      </a>
    </div>
  );
}
