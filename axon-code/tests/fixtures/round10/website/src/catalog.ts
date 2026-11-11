import { subtotal, applyDiscount } from './math';
export interface Item { id: string; name: string; price: number; }
export const items: Item[] = [
  { id: 'book', name: 'Notebook', price: 12 },
  { id: 'pens', name: 'Pen set', price: 18 }
];
export function checkout(discount: number) {
  const before = subtotal(items.map((item) => item.price));
  return { itemCount: items.length, before, total: applyDiscount(before, discount) };
}
