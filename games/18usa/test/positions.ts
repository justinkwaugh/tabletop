import { expect } from 'vitest'
import type { Owner } from '@tabletop/18xx'
import type { EighteenUSAState } from '../src/state.js'
import { EighteenUSATrainDepot } from '../src/trains.js'
import { edit, kit, type Table } from './kit.js'

/** Every player passes the private auction, which leaves the unsold privates closed. */
export function passOpening(game: Table): void {
    while (game.state.machineState === 'SelectionAuction') game.act('PassSelectionAuction')
    expect(game.state.machineState).toBe('StockRound')
}

export function setCash(game: Table, playerId: string, amount: number): void {
    edit(game, (state) => {
        const account = state.cash.find(
            (cash) => cash.owner.kind === 'player' && cash.owner.playerId === playerId
        )
        if (account) account.amount = amount
    })
}

/**
 * A 4-player game whose first company, ATSF, has started in the city and is laying track in the
 * first operating round, its state then changed by ``prepare``.
 */
export function operatingCompany(
    locationId: string,
    prepare: (state: EighteenUSAState) => void = () => {},
    {
        players = 4,
        seed = 9,
        amount = 100
    }: { players?: number; seed?: number; amount?: number } = {}
): Table {
    const game = kit.table(players, seed)
    passOpening(game)
    game.act('AuctionCompany', {
        companyId: 'ATSF',
        amount,
        home: { locationId, nodeId: 'city' }
    })
    while (game.state.companyAuction)
        if (game.valid(game.player).includes('FormCompany'))
            game.act('FormCompany', { companyId: 'ATSF', shareCount: 2, privateIds: [] })
        else game.act('PassCompanyAuction', { companyId: 'ATSF' })
    while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
    expect(game.state.machineState).toBe('LayingTrack')
    edit(game, prepare)
    return game
}

export function setPhase(state: EighteenUSAState, phaseId: string): void {
    state.phaseId = phaseId
}

export function companyCash(state: EighteenUSAState, companyId: string, amount: number): void {
    const account = state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === companyId
    )
    if (account) account.amount = amount
}

/** Gives the company the depot's next train of the kind. */
export function giveTrain(
    state: EighteenUSAState,
    companyId: string,
    definitionId: string
): string {
    const train = EighteenUSATrainDepot.nextTrain(state.trainInventory, definitionId)
    if (!train) throw new Error(`No ${definitionId} left`)
    EighteenUSATrainDepot.purchase(state.trainInventory, train.id, definitionId, {
        kind: 'company',
        companyId
    })
    return train.id
}

/** Gives a private to the company, as if contributed when it started. */
export function givePrivate(state: EighteenUSAState, privateId: string, to: string | Owner): void {
    const owner: Owner = typeof to === 'string' ? { kind: 'company', companyId: to } : to
    const company = state.companies.find((entry) => entry.id === privateId)
    if (!company) state.companies.push({ id: privateId, kind: 'private' })
    else delete company.closed
    const certificate = state.certificates.find(
        (entry) => entry.kind === 'private' && entry.companyId === privateId
    )
    if (certificate) {
        certificate.owner = owner
        delete certificate.poolId
    } else
        state.certificates.push({
            id: `${privateId}:charter`,
            companyId: privateId,
            kind: 'private',
            owner
        })
}

/**
 * A 3-player game with the variant options given, in phase 4, whose first player has started
 * ATSF as a 5-share company and holds every share but one, which stays in its treasury.
 */
export function presidentHoldingFive(config?: Record<string, boolean>): {
    game: Table
    president: string
} {
    const game = kit.table(3, 2, config)
    passOpening(game)
    edit(game, (state) => setPhase(state, '4'))
    const president = game.player
    game.act('AuctionCompany', {
        companyId: 'ATSF',
        amount: 100,
        home: { locationId: 'E15', nodeId: 'city' }
    })
    while (game.state.companyAuction)
        if (game.valid(game.player).includes('FormCompany'))
            game.act('FormCompany', { companyId: 'ATSF', shareCount: 5, privateIds: [] })
        else game.act('PassCompanyAuction', { companyId: 'ATSF' })
    edit(game, (state) => {
        const treasury = state.certificates.filter(
            (certificate) =>
                certificate.kind === 'share' &&
                certificate.companyId === 'ATSF' &&
                certificate.owner.kind === 'company'
        )
        for (const certificate of treasury.slice(1)) {
            certificate.owner = { kind: 'player', playerId: president }
            delete certificate.poolId
        }
    })
    return { game, president }
}

/** Moves every share left in the company's treasury to the player. */
export function emptyTreasury(game: Table, companyId: string, playerId: string): void {
    edit(game, (state) => {
        for (const certificate of state.certificates)
            if (
                certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                certificate.owner.kind === 'company'
            ) {
                certificate.owner = { kind: 'player', playerId }
                delete certificate.poolId
            }
    })
}
