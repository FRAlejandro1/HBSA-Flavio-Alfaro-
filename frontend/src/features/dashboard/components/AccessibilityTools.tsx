interface Props {
  anunciar: (mensaje: string) => void;
}

export function AccessibilityTools({ anunciar }: Props) {
  return (
    <div className="accessibility-tools" aria-label="Accesibilidad">
      <button
        type="button"
        onClick={() => {
          document.documentElement.style.setProperty('--escala-texto', '0.9');
          anunciar('Tamaño de texto reducido.');
        }}
        aria-label="Reducir tamaño del texto"
        title="Reducir texto"
      >A−</button>
      <button
        type="button"
        onClick={() => {
          document.documentElement.style.setProperty('--escala-texto', '1');
          anunciar('Tamaño de texto normal.');
        }}
        aria-label="Restablecer tamaño del texto"
        title="Texto normal"
      >A</button>
      <button
        type="button"
        onClick={() => {
          document.documentElement.style.setProperty('--escala-texto', '1.15');
          anunciar('Tamaño de texto aumentado.');
        }}
        aria-label="Aumentar tamaño del texto"
        title="Aumentar texto"
      >A+</button>
    </div>
  );
}
