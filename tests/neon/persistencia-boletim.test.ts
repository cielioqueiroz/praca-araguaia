import { afterEach, expect, it, vi } from 'vitest';

const repositorio = vi.hoisted(() => ({ reservar: vi.fn() }));
vi.mock('@/lib/neon/repositorio-boletim', () => ({
  repositorioBoletimNeon: vi.fn(() => repositorio),
}));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));

import { persistenciaBoletim } from '@/lib/persistencia-boletim';
import { repositorioBoletimNeon } from '@/lib/neon/repositorio-boletim';
import { createServerClient } from '@/lib/supabase/server';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it('escolhe a reserva SQL no Neon sem criar cliente Supabase', () => {
  vi.stubEnv('DATABASE_PROVIDER', 'neon');

  expect(persistenciaBoletim()).toBe(repositorio);
  expect(repositorioBoletimNeon).toHaveBeenCalledOnce();
  expect(createServerClient).not.toHaveBeenCalled();
});
