/** Decodes a NFC-e / SAT QR the same way as the web scanner. */
export type NfceData = {
  chaveAcesso: string;
  uf: string;
  estado: string;
  cnpj: string;
  cnpjFormatado: string;
  modelo: 'NFC-e' | 'SAT' | 'NF-e' | 'Outro';
  numero: string;
  valorTotal?: number;
  urlConsulta?: string;
  valida: boolean;
  erroValidacao?: string;
};

const UF: Record<string, { sigla: string; nome: string }> = {
  '11': { sigla: 'RO', nome: 'Rondônia' }, '12': { sigla: 'AC', nome: 'Acre' }, '13': { sigla: 'AM', nome: 'Amazonas' },
  '14': { sigla: 'RR', nome: 'Roraima' }, '15': { sigla: 'PA', nome: 'Pará' }, '16': { sigla: 'AP', nome: 'Amapá' },
  '17': { sigla: 'TO', nome: 'Tocantins' }, '21': { sigla: 'MA', nome: 'Maranhão' }, '22': { sigla: 'PI', nome: 'Piauí' },
  '23': { sigla: 'CE', nome: 'Ceará' }, '24': { sigla: 'RN', nome: 'Rio Grande do Norte' }, '25': { sigla: 'PB', nome: 'Paraíba' },
  '26': { sigla: 'PE', nome: 'Pernambuco' }, '27': { sigla: 'AL', nome: 'Alagoas' }, '28': { sigla: 'SE', nome: 'Sergipe' },
  '29': { sigla: 'BA', nome: 'Bahia' }, '31': { sigla: 'MG', nome: 'Minas Gerais' }, '32': { sigla: 'ES', nome: 'Espírito Santo' },
  '33': { sigla: 'RJ', nome: 'Rio de Janeiro' }, '35': { sigla: 'SP', nome: 'São Paulo' }, '41': { sigla: 'PR', nome: 'Paraná' },
  '42': { sigla: 'SC', nome: 'Santa Catarina' }, '43': { sigla: 'RS', nome: 'Rio Grande do Sul' }, '50': { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  '51': { sigla: 'MT', nome: 'Mato Grosso' }, '52': { sigla: 'GO', nome: 'Goiás' }, '53': { sigla: 'DF', nome: 'Distrito Federal' },
};

function checkDigit(chave43: string): number {
  let sum = 0;
  let weight = 2;
  for (let index = chave43.length - 1; index >= 0; index -= 1) {
    sum += Number(chave43[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest === 0 || rest === 1 ? 0 : 11 - rest;
}

function formatCnpj(value: string) {
  return value.length === 14 ? value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : value;
}

function money(value: string | null | undefined): number | undefined {
  if (!value || !/^\d+[.,]\d{2}$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseNfceQrCode(input: string): NfceData {
  const empty = (erroValidacao: string, extra?: Partial<NfceData>): NfceData => ({
    chaveAcesso: '', uf: '', estado: '', cnpj: '', cnpjFormatado: '', modelo: 'Outro', numero: '', valida: false, erroValidacao, ...extra,
  });
  if (!input?.trim()) return empty('Entrada vazia ou inválida.');
  const trimmed = input.trim();
  let chave44 = '';
  let valorTotal: number | undefined;
  let urlConsulta: string | undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    urlConsulta = trimmed;
    try {
      const url = new URL(trimmed);
      const parts = (url.searchParams.get('p') || url.searchParams.get('P') || '').split('|');
      const candidate = parts[0]?.replace(/\D/g, '') || '';
      if (candidate.length === 44) chave44 = candidate;
      for (const part of parts.slice(1)) valorTotal ??= money(part);
      const named = url.searchParams.get('chNFe')?.replace(/\D/g, '') || '';
      if (named.length === 44) chave44 = named;
      valorTotal ??= money(url.searchParams.get('vNF'));
    } catch { /* keep searching the raw text */ }
  }
  if (!chave44) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 44) chave44 = digits;
    else if (digits.length === 43) chave44 = `${digits}${checkDigit(digits)}`;
    else chave44 = trimmed.match(/\b\d{44}\b/)?.[0] || trimmed.split('|').map(part => part.replace(/\D/g, '')).find(part => part.length === 44) || '';
  }
  if (chave44.length !== 44) return empty('Chave de acesso de 44 dígitos não encontrada.', { urlConsulta, valorTotal });
  const cUf = chave44.slice(0, 2);
  const cnpj = chave44.slice(6, 20);
  const modelCode = chave44.slice(20, 22);
  const modelo = modelCode === '65' ? 'NFC-e' : modelCode === '59' ? 'SAT' : modelCode === '55' ? 'NF-e' : 'Outro';
  const uf = UF[cUf] || { sigla: 'BR', nome: 'Brasil' };
  const valida = Number(chave44[43]) === checkDigit(chave44.slice(0, 43));
  return {
    chaveAcesso: chave44, uf: uf.sigla, estado: uf.nome, cnpj, cnpjFormatado: formatCnpj(cnpj), modelo,
    numero: String(Number(chave44.slice(25, 34))), valorTotal, urlConsulta, valida,
    erroValidacao: valida ? undefined : 'Dígito verificador da chave de acesso é inválido.',
  };
}
