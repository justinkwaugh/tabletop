export type AuctionSelection = { kind: 'buy' | 'bid'; lotId: string; amount: number }

export type OfferAuctionSelection = { lotId: string; amount?: number }
