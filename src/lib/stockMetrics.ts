export type StockMetricLot = {
  quantity: number | null;
  cost_price: number | null;
  retail_price?: number | null;
};

export type StockMetricVariant = {
  stock_qty: number | null;
  cost_price: number | null;
  price: number | null;
  is_available?: boolean | null;
  products?: { min_stock: number | null } | null;
  variant_lot_prices?: StockMetricLot[] | null;
};

export function getVariantQuantity(variant: StockMetricVariant): number {
  const lots = variant.variant_lot_prices ?? [];
  return lots.length > 0
    ? lots.reduce((sum, lot) => sum + Number(lot.quantity ?? 0), 0)
    : Number(variant.stock_qty ?? 0);
}

export function getVariantCost(variant: StockMetricVariant): number {
  const lots = variant.variant_lot_prices ?? [];
  if (lots.length === 0) return Number(variant.cost_price ?? 0);
  return lots.reduce((sum, lot) => sum + Number(lot.quantity ?? 0) * Number(lot.cost_price ?? 0), 0);
}

export function getVariantRetail(variant: StockMetricVariant): number {
  const lots = variant.variant_lot_prices ?? [];
  if (lots.length === 0) return getVariantQuantity(variant) * Number(variant.price ?? 0);
  return lots.reduce((sum, lot) => sum + Number(lot.quantity ?? 0) * Number(lot.retail_price ?? 0), 0);
}

export function isVariantLowStock(variant: StockMetricVariant): boolean {
  return getVariantQuantity(variant) <= Number(variant.products?.min_stock ?? 5);
}

export type FifoLotPick = {
  lot_id: string;
  lot_label: string;
  take: number;
  remaining_before: number;
};

/**
 * Given a list of variant lots (each with id, label, quantity, received_date/created_at),
 * compute how much to take from each lot to fulfill `need`, oldest first (FIFO).
 * Lots with zero/negative quantity are skipped. Never takes more than available.
 */
export function computeFifoPicks(
  lots: { id: string; lot_label: string; quantity: number | null; received_date?: string | null; created_at?: string | null }[],
  need: number
): FifoLotPick[] {
  const sorted = [...lots]
    .filter((l) => Number(l.quantity ?? 0) > 0)
    .sort((a, b) => {
      const ta = a.received_date ?? a.created_at ?? '';
      const tb = b.received_date ?? b.created_at ?? '';
      if (ta !== tb) return ta < tb ? -1 : 1;
      return 0;
    });
  const picks: FifoLotPick[] = [];
  let remaining = need;
  for (const lot of sorted) {
    if (remaining <= 0) break;
    const available = Number(lot.quantity ?? 0);
    const take = Math.min(available, remaining);
    picks.push({ lot_id: lot.id, lot_label: lot.lot_label, take, remaining_before: available });
    remaining -= take;
  }
  return picks;
}
