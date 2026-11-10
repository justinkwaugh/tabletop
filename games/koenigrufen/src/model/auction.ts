import * as Type from 'typebox'
import {
    Contract,
    contractDefinition,
    contractRank,
    ContractSchema,
    PlayableContracts
} from '../components/contracts.js'

export type HeldBid = Type.Static<typeof HeldBid>
export const HeldBid = Type.Object({
    playerId: Type.String(),
    contract: ContractSchema
})

export type Auction = Type.Static<typeof Auction>
export const Auction = Type.Object({
    // Forehand reserved the game with "Mein Spiel".
    meinSpiel: Type.Boolean(),
    bid: Type.Optional(HeldBid),
    passed: Type.Array(Type.String())
})

export function newAuction(): Auction {
    return { meinSpiel: false, passed: [] }
}

export function isAuctionUnopened(auction: Auction): boolean {
    return !auction.meinSpiel && auction.bid === undefined && auction.passed.length === 0
}

// `seats` lists the players in priority order, Forehand first. A player with higher priority than
// the holder may hold the bid at the same contract; anyone else must bid higher. Forehand may open
// with a forehand-opening contract (Sechserdreier) instead of "Mein Spiel"; Forehand's other
// contracts are only for naming after "Mein Spiel" is passed out.
export function biddableContracts(
    auction: Auction,
    seats: readonly string[],
    playerId: string
): Contract[] {
    const held = auction.bid
    const minimum =
        held === undefined
            ? 0
            : contractRank(held.contract) +
              (seats.indexOf(playerId) < seats.indexOf(held.playerId) ? 0 : 1)
    const opening = playerId === seats[0] && isAuctionUnopened(auction)
    return PlayableContracts.filter((contract) => {
        const definition = contractDefinition(contract)
        const allowed = definition.forehandOpening ? opening : !definition.forehandOnly
        return allowed && contractRank(contract) >= minimum
    })
}

export function nameableContracts(): Contract[] {
    return PlayableContracts.filter((contract) => !contractDefinition(contract).forehandOpening)
}

export function remainingBidders(auction: Auction, seats: readonly string[]): string[] {
    return seats.filter((playerId) => !auction.passed.includes(playerId))
}

export function isAuctionOver(auction: Auction, seats: readonly string[]): boolean {
    return remainingBidders(auction, seats).length === 1
}
