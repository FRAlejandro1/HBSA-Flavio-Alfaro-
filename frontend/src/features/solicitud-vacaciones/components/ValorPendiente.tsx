interface Props {
  texto?: string;
}

// Valor que aún no llega del servidor: se ve un guion y el lector de pantalla lo explica.
export function ValorPendiente({ texto = '—' }: Props) {
  return (
    <>
      <span aria-hidden="true">{texto}</span>
      <span className="sr-only">dato no disponible por ahora</span>
    </>
  );
}