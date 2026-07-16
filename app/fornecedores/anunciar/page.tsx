import { FormAnuncioFornecedor } from '@/components/FormAnuncioFornecedor';

export const metadata = { title: 'Anunciar nos fornecedores' };

export default function Anunciar() {
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pasto">Fornecedores</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-mata">Anuncie na praça</h1>
      <p className="mt-1 text-sm text-tinta/50">Cadastre sua empresa — entra na vitrine depois de uma conferência rápida.</p>
      <div className="mt-6">
        <FormAnuncioFornecedor />
      </div>
    </main>
  );
}
