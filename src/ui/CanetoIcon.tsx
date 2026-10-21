import Svg, { Path } from 'react-native-svg';

const paths = {
  produce: 'M12 8C6 3 2 8 5 16c2 6 5 4 7 4s5 2 7-4c3-8-1-13-7-8ZM12 8V4m0 2c0-3 3-4 5-3-1 3-3 4-5 3',
  meat: 'M5 8c4-5 11-5 14 0s-1 11-7 12S1 14 5 8Zm4 2c2-2 6-2 7 1s-2 5-4 4-4-3-3-5Z',
  dairy: 'M8 3h8v4l2 3v11H6V10l2-3V3Zm0 4h8M6 11h12M9 15h6m-6 3h4',
  bakery: 'M5 10c2-5 7-8 11-6s5 6 2 10l-5 5c-4 4-10 1-10-3 0-2 1-4 2-6Zm3-3 3 3m1-6 3 3m-9 4 3 3',
  package: 'M4 7l8-4 8 4v11l-8 3-8-3V7Zm0 0 8 4 8-4m-8 4v10M8 5l8 4v4',
  drinks: 'M7 7h10l-1 14H8L7 7Zm-1 0h12M12 7V3l5-1M8 12h8',
  cleaning: 'M9 4h8v3h-3v3l3 4v7H6v-7l3-4V4Zm0 3h5m-8 8h11M4 3v4M2 5h4',
  hygiene: 'M8 8h8l2 3v10H6V11l2-3Zm4 0V4m-3 0h8v2M9 14h6m-6 3h4',
  frozen: 'M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3M9 20l3-3 3 3M3 11l4-1V6m14 7-4 1v4M3 13l4 1v4m14-7-4-1V6',
  pet: 'M8 14c3-5 5-5 8 0 5 5 0 8-4 5-4 3-9 0-4-5ZM6 6c-3 0-3 5 0 5s3-5 0-5Zm5-3c-3 0-3 5 0 5s3-5 0-5Zm6 1c-3 0-3 5 0 5s3-5 0-5Zm3 6c-2 0-2 4 0 4s2-4 0-4Z',
  tag: 'M3 4h9l9 9-8 8-10-9V4Zm4 4h.01',
  list: 'M8 4h12v17H4V4h4Zm0 0V2h8v4H8V4Zm0 7 1 1 2-2m3 1h3m-9 5 1 1 2-2m3 1h3',
  store: 'M4 10v11h16V10M3 10l2-7h14l2 7c-1 3-4 3-5 0-1 3-4 3-5 0-1 3-4 3-5 0-1 2-2 2-3 0Zm6 11v-6h6v6',
  wholesale: 'M3 9l9-6 9 6v12H3V9Zm4 12V11h10v10M7 15h10M7 18h10',
  pharmacy: 'M5 3h14v18H5V3Zm5 5h4v3h3v4h-3v3h-4v-3H7v-4h3V8Z',
  all: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  social: 'M8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm9 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM2 19v-3c0-6 12-6 12 0v3H2Zm14-6c3-1 6 1 6 4v2h-5',
  settings: 'M3 6h5m4 0h9M3 12h11m4 0h3M3 18h5m4 0h9M8 3h4v6H8V3Zm6 6h4v6h-4V9ZM8 15h4v6H8v-6Z',
  receipt: 'M5 3l3 2 4-2 4 2 3-2v18l-3-2-4 2-4-2-3 2V3Zm3 6h8m-8 4h8m-8 4h4',
  idea: 'M8 16c-6-5-2-13 4-13s10 8 4 13v3H8v-3Zm0 0h8m-6 6h4M12 8v5',
  notice: 'M4 9h5l11-5v16L9 15H4V9Zm3 6 2 6h4l-2-5M9 9v6',
  cart: 'M2 4h3l2 12h12l3-9H6M9 20h.01M18 20h.01M10 11h7',
  pin: 'M12 22S4 15 4 9a8 8 0 0 1 16 0c0 6-8 13-8 13Zm0-16a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  plus: 'M12 4v16M4 12h16',
  check: 'M4 12l5 5L20 6',
  home: 'M3 10.5 12 3l9 7.5V21H14v-6h-4v6H3V10.5Z',
} as const;

export type CanetoIconName = keyof typeof paths;
const categoryNames: Record<string, CanetoIconName> = {
  hortifruti: 'produce', acougue: 'meat', butcher: 'meat', frios: 'dairy',
  padaria: 'bakery', mercearia: 'package', bebidas: 'drinks', beverages: 'drinks',
  limpeza: 'cleaning', higiene: 'hygiene', congelados: 'frozen', petshop: 'pet',
  outros: 'tag', supermarket: 'cart', convenience: 'store',
};

export function CanetoIcon({ name, size = 20, color = '#0F172A' }: {
  name: string;
  size?: number;
  color?: string;
}) {
  const icon = categoryNames[name] ?? (name in paths ? name as CanetoIconName : 'store');
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d={paths[icon]} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}
