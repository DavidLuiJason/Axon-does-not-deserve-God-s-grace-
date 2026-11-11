export function subtotal(prices: readonly number[]): number {
  return prices.reduce((sum, price) => sum + price, 0);
}
export function applyDiscount(value: number, percentage: number): number {
  if (percentage < 0 || percentage > 100) throw new RangeError('Discount must be between 0 and 100.');
  return Math.round(value * (100 - percentage)) / 100;
}
