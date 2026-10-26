export type UnitType = 'un' | 'kg' | 'g' | 'L' | 'ml' | 'pct' | 'cx' | 'dz' | 'lata' | 'garrafa';

export interface CategoryInfo {
  id: string;
  name: string;
  color: string;
  background: string;
  order: number;
}

export const CATEGORIES: Record<string, CategoryInfo> = {
  hortifruti: { id: 'hortifruti', name: 'Hortifrúti', color: '#065F46', background: '#D1FAE5', order: 1 },
  acougue: { id: 'acougue', name: 'Carnes & Aves', color: '#9F1239', background: '#FFE4E6', order: 2 },
  frios: { id: 'frios', name: 'Frios & Laticínios', color: '#92400E', background: '#FEF3C7', order: 3 },
  padaria: { id: 'padaria', name: 'Padaria & Confeitaria', color: '#9A3412', background: '#FFEDD5', order: 4 },
  mercearia: { id: 'mercearia', name: 'Mercearia & Despensa', color: '#1E40AF', background: '#DBEAFE', order: 5 },
  bebidas: { id: 'bebidas', name: 'Bebidas & Sucos', color: '#155E75', background: '#CFFAFE', order: 6 },
  limpeza: { id: 'limpeza', name: 'Limpeza & Casa', color: '#6B21A8', background: '#F3E8FF', order: 7 },
  higiene: { id: 'higiene', name: 'Higiene & Beleza', color: '#9D174D', background: '#FCE7F3', order: 8 },
  congelados: { id: 'congelados', name: 'Congelados', color: '#075985', background: '#E0F2FE', order: 9 },
  pet: { id: 'pet', name: 'Pet Shop', color: '#115E59', background: '#CCFBF1', order: 10 },
  outros: { id: 'outros', name: 'Outros', color: '#334155', background: '#F1F5F9', order: 11 },
};

export const categoryFor = (id?: string | null): CategoryInfo => {
  if (!id) return CATEGORIES.outros;
  return CATEGORIES[id] ?? CATEGORIES.outros;
};

// Dicionário inteligente em Português para categorização automática
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  hortifruti: [
    'banana', 'maca', 'maçã', 'pera', 'uva', 'laranja', 'limao', 'limão', 'abacaxi', 'melancia',
    'melao', 'melão', 'mamao', 'mamão', 'manga', 'morango', 'maracuja', 'maracujá', 'tomate',
    'cebola', 'alho', 'batata', 'cenoura', 'alface', 'rucula', 'rúcula', 'espinafre', 'couve',
    'brocolis', 'brócolis', 'repolho', 'pimentao', 'pimentão', 'abobrinha', 'berinjela', 'pepino',
    'cheiro verde', 'coentro', 'salsa', 'cebolinha', 'hortela', 'hortelã', 'mandioca', 'aipim',
    'beterraba', 'chuchu', 'abobora', 'abóbora', 'gengibre', 'kiwi', 'abacate'
  ],
  acougue: [
    'carne', 'alcatra', 'picanha', 'patinho', 'coxao', 'coxão', 'costela', 'bife', 'maminha',
    'fraldinha', 'contra file', 'contra filé', 'frango', 'peito de frango', 'coxa', 'sobrecoxa',
    'asa', 'linguica', 'linguiça', 'bacon', 'lombo', 'pernil', 'suino', 'suíno', 'porco',
    'peixe', 'salmao', 'salmão', 'tilapia', 'tilápia', 'camarao', 'camarão', 'bacalhau',
    'carne moida', 'carne moída', 'hamburguer', 'hambúrguer', 'costelinha', 'figado', 'fígado'
  ],
  frios: [
    'leite', 'queijo', 'mussarela', 'mucarela', 'muçarela', 'prato', 'parmesao', 'parmesão',
    'requeijao', 'requeijão', 'presunto', 'mortadela', 'salame', 'peito de peru', 'iogurte',
    'manteiga', 'margarina', 'creme de leite', 'leite condensado', 'ricota', 'nata', 'chantilly',
    'cream cheese', 'danone', 'coalhada', 'yakult'
  ],
  padaria: [
    'pao', 'pão', 'pao frances', 'pão francês', 'pao de forma', 'pão de forma', 'baguete',
    'bisnaga', 'torrada', 'bolo', 'torta', 'sonho', 'croissant', 'rosca', 'biscoito',
    'bolacha', 'pao de queijo', 'pão de queijo', 'broa', 'pastel', 'salgado'
  ],
  mercearia: [
    'arroz', 'feijao', 'feijão', 'acucar', 'açúcar', 'sal', 'oleo', 'óleo', 'azeite', 'vinagre',
    'macarrao', 'macarrão', 'molho de tomate', 'extrato', 'farinha', 'trigo', 'fuba', 'fubá',
    'milho', 'ervilha', 'sardinha', 'atum', 'cafe', 'café', 'cha', 'chá', 'achocolatado',
    'nescau', 'toddy', 'aveia', 'cereal', 'maionese', 'ketchup', 'mostarda', 'fermento',
    'gelatina', 'azeitona', 'palmito', 'grao de bico', 'grão de bico', 'lentilha', 'pipoca'
  ],
  bebidas: [
    'agua', 'água', 'agua de coco', 'refrigerante', 'coca', 'guarana', 'guaraná', 'fanta',
    'suco', 'suco de uva', 'suco de laranja', 'cerveja', 'vinho', 'vodka', 'gin', 'whisky',
    'energetico', 'energético', 'cha gelado', 'tônica', 'tonica', 'isotônico', 'gatorade'
  ],
  limpeza: [
    'sabao', 'sabão', 'sabao em po', 'sabão em pó', 'detergente', 'det.', 'amaciante', 'amac.', 'desinfetante',
    'desinf.', 'agua sanitaria', 'água sanitária', 'ag.sanit', 'cloro', 'esponja', 'bombril', 'palha de aco',
    'multiuso', 'veja', 'limp.', 'limp ', 'lustra moveis', 'inseticida', 'saco de lixo', 'vassoura', 'rodo',
    'pano de chao', 'pano de prato', 'papel toalha', 'guardanapo', 'alvejante', 'desengordurante',
    'minuano', 'ype', 'ypê', 'omo', 'tixan', 'downy', 'comfort', 'pinho', 'lysoform', 'limpol', 'cif', 'ajax'
  ],
  higiene: [
    'sabonete', 'sab.flor', 'sab.liq', 'sab.int', 'shampoo', 'xampu', 'condicionador', 'cond.',
    'creme dental', 'cr.dental', 'cr dental', 'dentifricio', 'pasta de dente', 'oral-b', 'oral b', 'colgate', 'sorriso', 'sensodyne',
    'escova de dente', 'esc.dental', 'fio dental', 'papel higienico', 'papel higiênico', 'pap.hig', 'desodorante', 'desod.',
    'absorvente', 'abs.', 'cotonete', 'algodao', 'algodão', 'lamina', 'gillette', 'barbeador',
    'hidratante', 'protetor solar', 'enxaguante', 'listerine', 'lenco umedecido', 'lenço', 'rexona', 'dove', 'nivea'
  ],
  congelados: [
    'sorvete', 'picole', 'picolé', 'pizza congelada', 'lasanha', 'nuggets', 'batata congelada',
    'hamburguer congelado', 'legumes congelados', 'acai', 'açaí', 'polpa de fruta'
  ],
  pet: [
    'racao', 'ração', 'racao cachorro', 'racao gato', 'petisco', 'areia de gato',
    'areia sanitaria', 'shampoo pet', 'tapete higienico', 'sache', 'sachê', 'whiskas', 'pedigree'
  ],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Descobre a categoria adequada com base no nome do produto
 */
export function suggestCategory(itemName: string): string {
  const normName = normalizeText(itemName);

  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      const normKw = normalizeText(kw);
      if (normName.includes(normKw) || normKw.includes(normName)) {
        return catId;
      }
    }
  }

  return 'outros';
}

export interface ParsedItemInput {
  name: string;
  quantity: number;
  unit: UnitType;
  price?: number;
  categoryId: string;
}

/**
 * Parser inteligente de entrada rápida (ex: 2kg de alcatra, 3 caixas de leite, arroz R$ 24,90)
 */
export function parseQuickItemInput(raw: string): ParsedItemInput {
  let text = raw.trim();
  let quantity = 1;
  let unit: UnitType = 'un';
  let price: number | undefined = undefined;

  // 1. Extrair Preço (ex: R$ 15,90 ou @ 12.50 ou por R$ 12,90)
  const priceRegex = /(?:r\$|@|por\s+r\$)\s*([\d]+(?:[.,]\d{1,2})?)/i;
  const priceMatch = text.match(priceRegex);
  if (priceMatch) {
    const rawPrice = priceMatch[1].replace(',', '.');
    const parsedPrice = parseFloat(rawPrice);
    if (!isNaN(parsedPrice)) {
      price = parsedPrice;
      text = text.replace(priceMatch[0], '').trim();
    }
  }

  // 2. Extrair Quantidade Fracionária no início (ex: 1/2 kg, meio kg, meia dúzia, 1/4)
  const fractionPatterns: { regex: RegExp; qty: number; unit: UnitType }[] = [
    { regex: /^(?:1\/2|meio)\s*(?:kg|quilo|quilos?)\s+(?:de\s+)?/i, qty: 0.5, unit: 'kg' },
    { regex: /^(?:1\/2|meio)\s*(?:l|litro|litros?)\s+(?:de\s+)?/i, qty: 0.5, unit: 'L' },
    { regex: /^(?:1\/2|meia)\s*(?:dz|duzia|dúzia|duzias|dúzias?)\s+(?:de\s+)?/i, qty: 0.5, unit: 'dz' },
    { regex: /^1\/2\s+(?:de\s+)?/i, qty: 0.5, unit: 'un' },
    { regex: /^(?:1\/4)\s*(?:kg|quilo|quilos?)\s+(?:de\s+)?/i, qty: 0.25, unit: 'kg' },
    { regex: /^(?:3\/4)\s*(?:kg|quilo|quilos?)\s+(?:de\s+)?/i, qty: 0.75, unit: 'kg' },
    { regex: /^1\/4\s+(?:de\s+)?/i, qty: 0.25, unit: 'un' },
    { regex: /^3\/4\s+(?:de\s+)?/i, qty: 0.75, unit: 'un' },
  ];

  let matchedFraction = false;
  for (const { regex, qty, unit: matchedUnit } of fractionPatterns) {
    const match = text.match(regex);
    if (match) {
      quantity = qty;
      unit = matchedUnit;
      text = text.replace(match[0], '').trim();
      matchedFraction = true;
      break;
    }
  }

  // 3. Extrair Quantidade e Unidade Numérica Padrão no início (ex: 2kg, 500g, 3L, 2x, 1 cx, 2 dz)
  if (!matchedFraction) {
    const unitPatterns: { regex: RegExp; unit: UnitType }[] = [
      { regex: /^(\d+(?:[.,]\d+)?)\s*(?:kg|quilos?)\s+(?:de\s+)?/i, unit: 'kg' },
      { regex: /^(\d+(?:[.,]\d+)?)\s*(?:g|gramas?)\s+(?:de\s+)?/i, unit: 'g' },
      { regex: /^(\d+(?:[.,]\d+)?)\s*(?:l|litros?)\s+(?:de\s+)?/i, unit: 'L' },
      { regex: /^(\d+(?:[.,]\d+)?)\s*(?:ml)\s+(?:de\s+)?/i, unit: 'ml' },
      { regex: /^(\d+)\s*(?:pct|pcts|pacotes?)\s+(?:de\s+)?/i, unit: 'pct' },
      { regex: /^(\d+)\s*(?:cx|cxs|caixas?)\s+(?:de\s+)?/i, unit: 'cx' },
      { regex: /^(\d+)\s*(?:dz|duzias?|dúzias?)\s+(?:de\s+)?/i, unit: 'dz' },
      { regex: /^(\d+)\s*(?:latas?)\s+(?:de\s+)?/i, unit: 'lata' },
      { regex: /^(\d+)\s*(?:garrafas?)\s+(?:de\s+)?/i, unit: 'garrafa' },
      { regex: /^(\d+(?:[.,]\d+)?)\s*(?:x|un|unid|unidades?)?\s+(?:de\s+)?/i, unit: 'un' },
    ];

    for (const { regex, unit: matchedUnit } of unitPatterns) {
      const match = text.match(regex);
      if (match) {
        const parsedQty = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(parsedQty) && parsedQty > 0) {
          quantity = parsedQty;
          unit = matchedUnit;
          text = text.replace(match[0], '').trim();
          break;
        }
      }
    }
  }

  // Limpeza final do nome do item
  text = text.replace(/^[-*•\s]+/, '').trim();
  if (!text) {
    text = raw.trim();
  }

  // Capitalizar primeira letra
  const formattedName = text.charAt(0).toUpperCase() + text.slice(1);
  const categoryId = suggestCategory(formattedName);

  return {
    name: formattedName,
    quantity,
    unit,
    price,
    categoryId,
  };
}
