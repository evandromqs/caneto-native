export type CheckboxStyle = 'circle' | 'switch';

export interface CheckboxStyleOption {
  id: CheckboxStyle;
  name: string;
  description: string;
}

export const CHECKBOX_STYLES: CheckboxStyleOption[] = [
  { id: 'circle', name: 'Círculo', description: 'O clássico, com preenchimento azul.' },
  { id: 'switch', name: 'Chave', description: 'Controle moderno com estilo interruptor.' },
];

export function normalizeCheckboxStyle(value: unknown): CheckboxStyle {
  return value === 'switch' ? 'switch' : 'circle';
}
