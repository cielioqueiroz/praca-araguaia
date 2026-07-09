export type TickerItem = { rotulo: string; valor: string; dir: 'up' | 'down'; pct: string };

const PADRAO: TickerItem[] = [
  { rotulo: 'BOI @', valor: '326,96', dir: 'down', pct: '1,54' },
  { rotulo: 'SOJA', valor: '112,20', dir: 'up', pct: '0,54' },
  { rotulo: 'MILHO', valor: '51,75', dir: 'down', pct: '1,99' },
  { rotulo: 'USD', valor: '5,1717', dir: 'down', pct: '0,44' },
  { rotulo: 'EUR', valor: '5,9486', dir: 'up', pct: '0,34' },
  { rotulo: 'OURO', valor: '21.699', dir: 'up', pct: '0,24' },
];

export function Ticker({ itens = PADRAO }: { itens?: TickerItem[] }) {
  const dobrado = [...itens, ...itens];
  return (
    <div className="ticker-strip" aria-hidden="true">
      <div className="ticker-track">
        {dobrado.map((it, i) => (
          <span key={i}>
            <b>{it.rotulo}</b> {it.valor}{' '}
            <span className={it.dir}>
              {it.dir === 'up' ? '▲' : '▼'}
              {it.pct}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
