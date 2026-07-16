import type { Feed } from '@/types/noticia';

// Registry de feeds — mesma ideia do lib/fontes/registry.ts: adicionar veículo é
// acrescentar uma linha aqui, e mais nada.
//
// `nicho: true` = veículo só de agro; tudo que ele publica interessa. `false` = o
// feed é amplo (economia geral) e passa pelo filtro de relevância do classificar.ts.
//
// REGRA DESTA LISTA: nenhuma URL entra sem ter respondido 200 com <item> parseável.
// Feed que cair é removido daqui, não "deixado quieto para ver se volta" — a página
// aguenta a ausência (Promise.allSettled), mas a lista não deve mentir sobre o que
// existe. Todas abaixo foram verificadas em 16/07/2026 (contagem de itens ao lado).
//
// Sem RSS, apurado no mesmo dia: R7, SBT News e Band (nenhuma variação de URL
// responde) e Notícias Agrícolas (só tem as páginas de cotação, que o lib/fontes já
// usa). Gazeta do Povo e Summit Agro devolvem HTML no lugar do feed. Por isso não
// estão aqui — não é esquecimento.
//
// AGROLINK FOI REMOVIDO: o feed responde 200 com 49 itens, mas a notícia mais nova
// é de 02/07/2020 — está abandonado há seis anos. Como a página ordena por data, os
// itens nunca apareceriam; seria só uma requisição jogada fora a cada revalidação.

export const FEEDS: Feed[] = [
  { id: 'g1-agro', veiculo: 'G1 Agronegócios', url: 'https://g1.globo.com/rss/g1/economia/agronegocios/', nicho: true }, // 100
  { id: 'globo-rural', veiculo: 'Globo Rural', url: 'https://g1.globo.com/rss/g1/economia/agronegocios/globo-rural/', nicho: true }, // 100
  { id: 'g1-economia', veiculo: 'G1 Economia', url: 'https://g1.globo.com/rss/g1/economia/', nicho: false }, // 98
  { id: 'canal-rural', veiculo: 'Canal Rural', url: 'https://www.canalrural.com.br/feed/', nicho: true }, // 10
  { id: 'cnn', veiculo: 'CNN Brasil', url: 'https://www.cnnbrasil.com.br/feed/', nicho: false }, // 60
  { id: 'infomoney', veiculo: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/', nicho: false }, // 10
  { id: 'money-times', veiculo: 'Money Times', url: 'https://www.moneytimes.com.br/feed/', nicho: false }, // 10
  { id: 'compre-rural', veiculo: 'Compre Rural', url: 'https://www.comprerural.com/feed/', nicho: true }, // 10
  { id: 'beefpoint', veiculo: 'BeefPoint', url: 'https://www.beefpoint.com.br/feed/', nicho: true }, // 10 — só pecuária
];
