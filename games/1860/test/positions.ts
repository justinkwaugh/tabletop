import { finiteCashOwnedBy, placeStockMarker } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { company1860 } from '../src/companies.js'
import type { State1860 } from '../src/state.js'
import { marketSpaceIdAt } from '../src/stockMarket.js'
import { kit, type Table } from './kit.js'

/** The players in seat order, the first opening the auction. */
export const Seats = ['p1', 'p2', 'p3', 'p4']

/** A table with the seats in order, its first auction opened by p1. */
export function seated(players = 3, config?: Record<string, boolean | string>): Table {
    return kit.table(players, 7, config, () => Seats.slice(0, players))
}

/**
 * Plays the opening with nobody bidding: each auction's opener takes the next certificate in
 * the given order, a director's share at the given par.
 */
export function openedWith(
    game: Table,
    choices: readonly { lotId: string; parPrice?: number }[] = [
        { lotId: 'BHC' },
        { lotId: 'YHC' },
        { lotId: 'CMH' },
        { lotId: 'RPSC' },
        { lotId: 'CN', parPrice: 74 },
        { lotId: 'IOW', parPrice: 74 }
    ]
): Table {
    for (const choice of choices) {
        while (game.state.choiceAuction && !game.state.choiceAuction.winner)
            game.act('PassForChoice')
        game.act('ChooseCertificate', choice)
    }
    return game
}

/** Sets a player's cash. */
export function setCash(state: State1860, playerId: string, amount: number): void {
    const account = state.cash.find(
        (entry) => entry.owner.kind === 'player' && entry.owner.playerId === playerId
    )
    assertExists(account, 'The player has cash')
    account.amount = amount
}

export function companyCash(state: State1860, companyId: string): number {
    return finiteCashOwnedBy(state, { kind: 'company', companyId })
}

export function playerCash(state: State1860, playerId: string): number {
    return finiteCashOwnedBy(state, { kind: 'player', playerId })
}

/** Moves a company's market marker to a price. */
export function setPrice(state: State1860, companyId: string, price: number): void {
    placeStockMarker(state.stockMarket, companyId, marketSpaceIdAt(price))
}

/**
 * A company that has floated and operated, held by its director with the given shares, its
 * price and treasury as given and its home base placed.
 */
export function running(
    state: State1860,
    companyId: string,
    playerId: string,
    options: { price?: number; shares?: number; cash?: number } = {}
): void {
    kit.operated(state, companyId, playerId, {
        price: 74,
        shares: options.shares ?? 6,
        cash: options.cash ?? 500
    })
    if (options.price && options.price !== 74) setPrice(state, companyId, options.price)
    company1860(companyId)
}
