import { describe, expect, it } from 'vitest';
import { compactarBoletim, type Boletim } from '@/lib/boletim';

describe('compactarBoletim', () => {
  it('mostra locais de estados distintos sem trocar preço, unidade ou fonte', () => {
    const boletim: Boletim = {
      dataExtenso: '6 de outubro de 2026',
      semReportes: false,
      porteira: [{
        tipo: 'boi', titulo: 'Boi gordo', unidade: 'R$ por arroba', rodape: 'Scot Consultoria · 05/10',
        ufs: [
          { nome: 'Redenção · PA', uf: 'PA', valorFmt: '310,00' },
          { nome: 'Marabá · PA', uf: 'PA', valorFmt: '312,00' },
          { nome: 'Mato Grosso', uf: 'MT', valorFmt: '290,00' },
        ],
        cidades: [{ municipio: 'Redenção', uf: 'PA', valorFmt: '305,00', contagem: 1 }],
      }],
      mercado: [
        { tipo: 'dolar', titulo: 'Dólar', valorFmt: 'R$ 5,20' },
        { tipo: 'bitcoin', titulo: 'Bitcoin', valorFmt: 'R$ 600.000' },
      ],
    };

    const compacto = compactarBoletim(boletim);
    expect(compacto.porteira[0]).toMatchObject({
      unidade: 'R$ por arroba', rodape: 'Scot · 05/10', totalLugares: 3,
      ufs: [{ nome: 'Redenção · PA', valorFmt: '310,00' }, { nome: 'Mato Grosso', valorFmt: '290,00' }],
      cidades: [],
    });
    expect(compacto.mercado.map((item) => item.tipo)).toEqual(['dolar']);
    expect(boletim.porteira[0].ufs).toHaveLength(3);
    expect(boletim.porteira[0].rodape).toBe('Scot Consultoria · 05/10');
  });
});
