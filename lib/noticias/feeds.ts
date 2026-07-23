import type { Feed } from '@/types/noticia';

// Registry de feeds — mesma ideia do lib/fontes/registry.ts: adicionar veículo é
// acrescentar uma linha aqui, e mais nada.
//
// TODO FEED PASSA PELO MESMO FILTRO (23/07/2026). Antes havia `nicho: true` para o
// veículo de agro, que dispensava a relevância — "tudo que ele publica interessa".
// Não interessava: Compre Rural mandou "Angelina Jolie trocou Hollywood pelas
// colmeias" e a Globo Rural, "Como montar uma horta em casa" e "mini-horses criados
// como pets". A origem diz de onde a matéria vem, não do que ela trata.
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
  { id: 'g1-agro', veiculo: 'G1 Agronegócios', url: 'https://g1.globo.com/rss/g1/economia/agronegocios/' }, // 100
  { id: 'globo-rural', veiculo: 'Globo Rural', url: 'https://g1.globo.com/rss/g1/economia/agronegocios/globo-rural/' }, // 100
  { id: 'g1-economia', veiculo: 'G1 Economia', url: 'https://g1.globo.com/rss/g1/economia/' }, // 98
  { id: 'canal-rural', veiculo: 'Canal Rural', url: 'https://www.canalrural.com.br/feed/' }, // 10
  { id: 'cnn', veiculo: 'CNN Brasil', url: 'https://www.cnnbrasil.com.br/feed/' }, // 60
  { id: 'infomoney', veiculo: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/' }, // 10
  { id: 'money-times', veiculo: 'Money Times', url: 'https://www.moneytimes.com.br/feed/' }, // 10
  { id: 'compre-rural', veiculo: 'Compre Rural', url: 'https://www.comprerural.com/feed/' }, // 10
  { id: 'beefpoint', veiculo: 'BeefPoint', url: 'https://www.beefpoint.com.br/feed/' }, // 10 — só pecuária
];
