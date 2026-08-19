// O convite que o produtor manda para o produtor.
//
// O site tem 30 acessos e 3 assinantes: o que falta não é funcionalidade, é gente.
// E a rede desta região é WhatsApp — grupo de fazenda, grupo de sindicato, grupo de
// leiloeiro. Então o botão que mais importa é o que entrega um texto pronto, curto e
// já com o link, para a pessoa só escolher o grupo.
//
// Nada aqui usa API paga do WhatsApp: `wa.me` é um link, e quem envia é o usuário.

export const SITE = 'https://agroapp-bay.vercel.app';

export type AlvoCompartilhamento = 'site' | 'cotacoes' | 'boletim' | 'termometro' | 'chuva' | 'fornecedores';

type Convite = { titulo: string; texto: string; caminho: string };

// Texto na voz do site: direto, sem "confira", sem "clique aqui", sem emoji de foguete.
const CONVITES: Record<AlvoCompartilhamento, Convite> = {
  site: {
    titulo: 'Praça Araguaia',
    texto: 'Preço do boi, da vaca, da soja e do milho nas praças do Vale do Araguaia, atualizado todo dia útil. De graça:',
    caminho: '/',
  },
  cotacoes: {
    titulo: 'A praça hoje',
    texto: 'O preço de hoje em Marabá, Redenção, Paragominas e nos estados vizinhos:',
    caminho: '/cotacoes',
  },
  boletim: {
    titulo: 'Boletim do dia',
    texto: 'O boletim de hoje da Praça Araguaia — preço da porteira ao mercado:',
    caminho: '/boletim',
  },
  termometro: {
    titulo: 'Termômetro da Praça',
    texto: 'Quanto o pessoal está pegando de verdade na nossa região. Se você vendeu, reporta o seu — é anônimo e leva um minuto:',
    caminho: '/termometro',
  },
  chuva: {
    titulo: 'Chuva na região',
    texto: 'A chuva dos próximos 7 dias nas cidades do Vale do Araguaia:',
    caminho: '/chuva',
  },
  fornecedores: {
    titulo: 'Fornecedores da região',
    texto: 'Ração, sal, defensivo, veterinário, peça de máquina — os fornecedores da região com contato direto:',
    caminho: '/fornecedores',
  },
};

export type Compartilhamento = { titulo: string; texto: string; url: string; mensagem: string };

/** O convite pronto: título e texto para a folha nativa, e a mensagem com link para o WhatsApp. */
export function convite(alvo: AlvoCompartilhamento, site: string = SITE): Compartilhamento {
  const { titulo, texto, caminho } = CONVITES[alvo];
  const url = caminho === '/' ? site : `${site}${caminho}`;
  return { titulo, texto, url, mensagem: `${texto} ${url}` };
}

/**
 * O link do WhatsApp SEM destinatário: abre a lista de conversas para a pessoa
 * escolher para quem manda. `wa.me/?text=` (sem número) é justamente isso — o mesmo
 * domínio que a vitrine já usa para falar com fornecedor.
 */
export function linkWhatsApp(alvo: AlvoCompartilhamento, site: string = SITE): string {
  return `https://wa.me/?text=${encodeURIComponent(convite(alvo, site).mensagem)}`;
}
