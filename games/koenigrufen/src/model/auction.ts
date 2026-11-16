import * as Type from 'typebox'
import {
    Contract,
    contractDefinition,
    ContractOrder,
    ContractSchema,
    PlayableContracts
} from '../components/contracts.js'
import { Bonus, Bonuses, BonusOrder, BonusSchema, isBird } from './announcements.js'

// A contract as bid. Besserrufer names its bird with the bid, which fixes its value.
export type BidChoice = Type.Static<typeof BidChoice>
export const BidChoice = Type.Object({
    contract: ContractSchema,
    bird: Type.Optional(BonusSchema)
})

export type HeldBid = Type.Static<typeof HeldBid>
export const HeldBid = Type.Object({
    playerId: Type.String(),
    ...BidChoice.properties
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

export function bidChoice(contract: Contract, bird?: Bonus): BidChoice {
    return bird === undefined ? { contract } : { contract, bird }
}

export function sameBid(a: BidChoice, b: BidChoice): boolean {
    return a.contract === b.contract && a.bird === b.bird
}

function choicesFor(contract: Contract): BidChoice[] {
    return contractDefinition(contract).namesBird
        ? BonusOrder.filter(isBird).map((bird) => bidChoice(contract, bird))
        : [bidChoice(contract)]
}

// The game plus a named bird at its announced value.
export function bidValue(choice: BidChoice): number {
    const bird = choice.bird === undefined ? 0 : Bonuses[choice.bird].announced
    return contractDefinition(choice.contract).win + bird
}

// House rule: a Besserrufer ranks with the contract of its value, or just above the most
// valuable contract below it when none matches.
export function bidRank(choice: BidChoice): number {
    if (choice.bird === undefined) {
        return ContractOrder.indexOf(choice.contract)
    }
    const value = bidValue(choice)
    const below = ContractOrder.filter((contract) => {
        const definition = contractDefinition(contract)
        return !definition.namesBird && definition.win <= value
    })
    const top = below.at(-1)
    if (top === undefined) {
        return -0.5
    }
    return ContractOrder.indexOf(top) + (contractDefinition(top).win === value ? 0 : 0.5)
}

function byRank(a: BidChoice, b: BidChoice): number {
    return bidRank(a) - bidRank(b)
}

// `seats` lists the players in priority order, Forehand first. A player with higher priority than
// the holder may hold the bid at the same rank; anyone else must bid higher. Forehand may open
// with a forehand-opening contract (Sechserdreier) instead of "Mein Spiel"; Forehand's other
// contracts are only for naming after "Mein Spiel" is passed out.
export function biddableChoices(
    auction: Auction,
    seats: readonly string[],
    playerId: string
): BidChoice[] {
    const held = auction.bid
    const mayHold = held !== undefined && seats.indexOf(playerId) < seats.indexOf(held.playerId)
    const opening = playerId === seats[0] && isAuctionUnopened(auction)
    return PlayableContracts.filter((contract) => {
        const definition = contractDefinition(contract)
        return definition.forehandOpening ? opening : !definition.forehandOnly
    })
        .flatMap(choicesFor)
        .filter(
            (choice) =>
                held === undefined ||
                (mayHold ? bidRank(choice) >= bidRank(held) : bidRank(choice) > bidRank(held))
        )
        .toSorted(byRank)
}

export function nameableChoices(): BidChoice[] {
    return PlayableContracts.filter((contract) => !contractDefinition(contract).forehandOpening)
        .flatMap(choicesFor)
        .toSorted(byRank)
}

export function remainingBidders(auction: Auction, seats: readonly string[]): string[] {
    return seats.filter((playerId) => !auction.passed.includes(playerId))
}

export function isAuctionOver(auction: Auction, seats: readonly string[]): boolean {
    return remainingBidders(auction, seats).length === 1
}
