export type CheckboxStyle = 'circle' | 'switch' | 'square';

export interface CheckboxStyleOption {
  id: CheckboxStyle;
  name: string;
  description: string;
}

export const CHECKBOX_STYLES: CheckboxStyleOption[] = [
  { id: 'circle', name: 'Círculo', description: 'O clássico, com preenchimento azul.' },
  { id: 'switch', name: 'Chave', description: 'Controle moderno com estilo interruptor.' },
  { id: 'square', name: 'Quadrado', description: 'Risco em V animado dentro de um quadrado.' },
];

export function normalizeCheckboxStyle(value: unknown): CheckboxStyle {
  if (value === 'switch') return 'switch';
  if (value === 'square') return 'square';
  return 'circle';
}
