export function Footer() {
  return (
    <footer className="mt-16 border-t border-linha">
      <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-8 text-xs text-tinta/50 sm:flex-row sm:items-baseline sm:justify-between">
        <p>Praça Araguaia — cotações do agro para a região do Araguaia.</p>
        <p>fontes: CONAB · BCB · BCE · Open-Meteo</p>
      </div>
    </footer>
  );
}
