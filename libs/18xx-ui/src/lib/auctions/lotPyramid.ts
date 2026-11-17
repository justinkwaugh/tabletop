import { assert, assertExists, PassableBidding } from '@tabletop/common'
import type { AuctionAward, SelectionAuctionModel } from '@tabletop/18xx'
import type { MoneyFormat } from '../presentation/money.js'

export type PyramidLotStatus =
    | { kind: 'open' }
    | { kind: 'waiting' }
    | { kind: 'bidding' }
    | { kind: 'sold'; award: AuctionAward }
    | { kind: 'removed' }

export type PyramidLot = { lotId: string; tier: number; status: PyramidLotStatus }

export type TierAfterSale =
    { kind: 'unchanged' } | { kind: 'opens'; tier: number } | { kind: 'ends' }

export type SaleConsequence = { removedLotIds: readonly string[]; tierAfter: TierAfterSale }

export function pyramidTiers(model: SelectionAuctionModel): (PyramidLot | undefined)[][] {
    return requireTiers(model).map((row, tier) =>
        row.map((lotId) => (lotId ? { lotId, tier, status: lotStatus(model, lotId) } : undefined))
    )
}

export function pyramidLot(model: SelectionAuctionModel, lotId: string): PyramidLot {
    const tier = requireTiers(model).findIndex((row) => row.includes(lotId))
    assert(tier >= 0, `Lot ${lotId} must be in the pyramid`)
    return { lotId, tier, status: lotStatus(model, lotId) }
}

export function lotStatus(model: SelectionAuctionModel, lotId: string): PyramidLotStatus {
    const auction = model.auction
    if (auction.bidding?.lotId === lotId) return { kind: 'bidding' }
    if (auction.remainingLotIds.includes(lotId))
        return { kind: model.nominationLotIds.includes(lotId) ? 'open' : 'waiting' }
    const award = auction.awards.find((item) => item.lotId === lotId)
    return award ? { kind: 'sold', award } : { kind: 'removed' }
}

export function lotStandingText(
    lot: PyramidLot,
    playerName: (playerId: string) => string,
    money: MoneyFormat
): string {
    switch (lot.status.kind) {
        case 'open':
            return `Row ${lot.tier + 1} · open`
        case 'waiting':
            return `Row ${lot.tier + 1} · not open yet`
        case 'bidding':
            return `Row ${lot.tier + 1} · being auctioned`
        case 'sold':
            return `Sold to ${playerName(lot.status.award.playerId)} for ${money(lot.status.award.price)}`
        case 'removed':
            return 'Removed from the game'
    }
}

export function openTier(model: SelectionAuctionModel): number {
    const tier = model.openTier()
    assertExists(tier, 'A running pyramid auction has an open tier')
    return tier
}

/** The lot being bid on goes to its high bidder; another to the player whose turn it is. */
function prospectiveAward(
    model: SelectionAuctionModel,
    lotId: string,
    amount: number
): AuctionAward {
    const bidding = model.auction.bidding
    if (bidding?.lotId === lotId) {
        const high = new PassableBidding(bidding.auction)
        return { lotId, playerId: high.highBidderId, price: high.highBid }
    }
    const playerId = model.playerId
    assertExists(playerId, 'A prospective sale needs the player whose turn it is')
    return { lotId, playerId, price: amount }
}

function saleConsequence(model: SelectionAuctionModel, award: AuctionAward): SaleConsequence {
    const removedLotIds = model.lotsRemovedBy(award)
    const after = model.openTier([award.lotId, ...removedLotIds])
    const tierAfter: TierAfterSale =
        after === undefined
            ? { kind: 'ends' }
            : after === openTier(model)
              ? { kind: 'unchanged' }
              : { kind: 'opens', tier: after }
    return { removedLotIds, tierAfter }
}

/** Undefined for a lot that cannot be sold now: closed, gone, or open while another is bid on. */
export function lotSaleConsequence(
    model: SelectionAuctionModel,
    lot: PyramidLot,
    amount: number
): SaleConsequence | undefined {
    const sellable =
        lot.status.kind === 'bidding' || (lot.status.kind === 'open' && !model.auction.bidding)
    return sellable ? saleConsequence(model, prospectiveAward(model, lot.lotId, amount)) : undefined
}

function requireTiers(model: SelectionAuctionModel) {
    const tiers = model.tiers
    assertExists(tiers, 'A lot pyramid requires a tiered selection auction')
    return tiers
}

export type TextSegment = { text: string; emphasis?: boolean }

/** "If sold, A and B leave the game, and row 5 opens." with the lot names emphasised. */
export function saleConsequenceText(
    tierAfter: TierAfterSale,
    removedNames: readonly string[]
): TextSegment[] | undefined {
    const clauses: TextSegment[][] = []
    if (removedNames.length)
        clauses.push([
            ...removedNames.flatMap((name, index) => [
                ...(index ? [{ text: index === removedNames.length - 1 ? ' and ' : ', ' }] : []),
                { text: name, emphasis: true }
            ]),
            { text: removedNames.length === 1 ? ' leaves the game' : ' leave the game' }
        ])
    if (tierAfter.kind === 'opens') clauses.push([{ text: `row ${tierAfter.tier + 1} opens` }])
    if (tierAfter.kind === 'ends') clauses.push([{ text: 'the auction ends' }])
    if (!clauses.length) return undefined
    return [
        { text: 'If sold, ' },
        ...clauses.flatMap((clause, index) => [...(index ? [{ text: ', and ' }] : []), ...clause]),
        { text: '.' }
    ]
}
