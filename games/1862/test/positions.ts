import { finiteCashOwnedBy, getCompany, placeStockMarker, type Owner } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { IpoPoolId, MarketPoolId, charterPoolId } from '../src/pools.js'
import type { State1862 } from '../src/state.js'
import { Market1862, marketSpaceIdAt } from '../src/stockMarket.js'
import { TileSet1862 } from '../src/tiles.js'
import { available, giveTrain, table, type Table } from './kit.js'

export type Holding = { owner: Owner | 'pool' | 'ipo'; shares: number }

export const player = (playerId: string) => ({ kind: 'player' as const, playerId })
export const treasury = (companyId: string) => ({ kind: 'company' as const, companyId })

export const cashOf = (game: Table, owner: Owner) => finiteCashOwnedBy(game.state, owner)

export const priceOf = (game: Table, companyId: string) =>
    Market1862.companySpace(game.state.stockMarket, companyId).price

/** Deals a company's certificates as listed, the director's to the first player holding three. */
export function hold(state: State1862, companyId: string, holdings: readonly Holding[]) {
    const certificates = state.certificates.filter((entry) => entry.companyId === companyId)
    const director = certificates.find((entry) => entry.kind === 'share' && entry.president)
    const ordinary = certificates.filter((entry) => entry !== director)
    for (const { owner, shares } of holdings) {
        let left = shares
        const place = (certificate: (typeof certificates)[number]) => {
            if (owner === 'pool')
                Object.assign(certificate, { owner: { kind: 'bank' }, poolId: MarketPoolId })
            else if (owner === 'ipo')
                Object.assign(certificate, { owner: { kind: 'bank' }, poolId: IpoPoolId })
            else if (owner.kind === 'company')
                Object.assign(certificate, { owner, poolId: charterPoolId(owner.companyId) })
            else {
                certificate.owner = owner
                delete certificate.poolId
            }
        }
        if (
            director &&
            left >= 3 &&
            owner !== 'pool' &&
            owner !== 'ipo' &&
            owner.kind === 'player' &&
            director.owner.kind === 'bank' &&
            director.poolId === IpoPoolId
        ) {
            place(director)
            getCompany(state, companyId).president = owner
            left -= 3
        }
        for (; left > 0; left--) {
            const next = ordinary.shift()
            if (!next) throw new Error('Not enough certificates')
            place(next)
        }
    }
}

export type Terms = { price: number; train: boolean; cash?: number }

/** A company that has floated and operated, at a price, with an Express train if it has one. */
export function floatAt(state: State1862, companyId: string, { price, train, cash = 100 }: Terms) {
    Object.assign(getCompany(state, companyId), {
        started: true,
        floated: true,
        funded: true,
        operated: true,
        parPrice: 100
    })
    placeStockMarker(state.stockMarket, companyId, marketSpaceIdAt(price))
    if (train) giveTrain(state, companyId, 'AE')
    const account = state.cash.find(
        (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
    )
    assertExists(account, 'Every company has a treasury')
    account.amount = cash
}

export function layTile(state: State1862, locationId: string, definitionId: string) {
    const [piece] = TileSet1862.availablePieces(state.tileInventory, definitionId)
    state.tileInventory = TileSet1862.replace(state.tileInventory, {
        locationId,
        placement: { pieceId: piece.id, definitionId, rotation: 0 },
        returnPrevious: true
    })
}

export type OperatingStep = 'LayingTrack' | 'BuyingTrains'

/** The operating round with the company's turn at the step, the companies before it done. */
export function operatingTurn(
    state: State1862,
    companyOrder: readonly string[],
    companyId: string,
    step: OperatingStep = 'LayingTrack'
) {
    state.operatingSet = {
        number: 1,
        roundNumber: 1,
        roundCount: 1,
        companyOrder: [...companyOrder],
        completedCompanyIds: companyOrder.slice(0, companyOrder.indexOf(companyId)),
        privateIncomePaid: true,
        completed: false
    }
    delete state.parliament
    delete state.trackStep
    delete state.trainPurchaseStep
    if (step === 'LayingTrack') state.trackStep = { companyId, lays: [], completed: false }
    else state.trainPurchaseStep = { companyId, purchasedTrainIds: [] }
    state.machineState = step
    const director = getCompany(state, companyId).president
    state.activePlayerIds = director?.kind === 'player' ? [director.playerId] : []
}

/** The first available companies, floated and sharing a city, the first starting its turn. */
export function twoCompanies(
    first: Terms,
    second: Terms,
    step: OperatingStep = 'LayingTrack'
): { game: Table; state: State1862; a: string; b: string } {
    const game: Table = table(4)
    const state = structuredClone(game.state)
    state.turnManager.turnOrder = ['p1', 'p2', 'p3', 'p4']
    const [a, b] = available(game)
    const hex = 'D11'
    layTile(state, hex, '18xx:14')
    for (const [slot, companyId, terms] of [
        [0, a, first],
        [1, b, second]
    ] as const) {
        floatAt(state, companyId, terms)
        state.stations.push({
            id: `${companyId}:home`,
            companyId,
            status: 'placed',
            position: { locationId: hex, nodeId: 'city', slot }
        })
    }
    operatingTurn(state, [a, b], a, step)
    return { game, state, a, b }
}
