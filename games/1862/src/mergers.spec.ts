import {
    finiteCashOwnedBy,
    getCompany,
    placeStockMarker,
    sharesOwned,
    type Owner
} from '@tabletop/18xx'
import { describe, expect, it } from 'vitest'
import { giveTrain, table, type Table } from '../test/kit.js'
import { IpoPoolId, MarketPoolId, charterPoolId } from './pools.js'
import type { State1862 } from './state.js'
import { Market1862, marketSpaceIdAt } from './stockMarket.js'
import { TileSet1862 } from './tiles.js'

type Holding = { owner: Owner | 'pool' | 'ipo'; shares: number }

const player = (playerId: string): Owner => ({ kind: 'player', playerId })

/** Deals a company's certificates as listed, the director's to the first holder of three. */
function hold(state: State1862, companyId: string, holdings: readonly Holding[]) {
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
            director.owner.kind === 'bank' &&
            director.poolId === IpoPoolId
        ) {
            place(director)
            getCompany(state, companyId).president = owner as Extract<Owner, { kind: 'player' }>
            left -= 3
        }
        for (; left > 0; left--) {
            const next = ordinary.shift()
            if (!next) throw new Error('Not enough certificates')
            place(next)
        }
    }
}

/** Two floated companies sharing a city, the first starting its turn. */
function twoCompanies(
    first: { price: number; train: boolean },
    second: { price: number; train: boolean }
) {
    const game: Table = table(4)
    const state = structuredClone(game.state)
    state.turnManager.turnOrder = ['p1', 'p2', 'p3', 'p4']
    const [a, b] = Object.entries(state.availability)
        .filter(([, phase]) => phase === 'A')
        .map(([id]) => id)
    const [piece] = TileSet1862.availablePieces(state.tileInventory, '18xx:14')
    const hex = 'D11'
    state.tileInventory = TileSet1862.replace(state.tileInventory, {
        locationId: hex,
        placement: { pieceId: piece.id, definitionId: '18xx:14', rotation: 0 },
        returnPrevious: true
    })
    for (const [index, [companyId, terms]] of [
        [a, first],
        [b, second]
    ].entries() as IterableIterator<[number, [string, { price: number; train: boolean }]]>) {
        Object.assign(getCompany(state, companyId), {
            started: true,
            floated: true,
            funded: true,
            operated: true,
            parPrice: 100
        })
        placeStockMarker(state.stockMarket, companyId, marketSpaceIdAt(terms.price))
        state.stations.push({
            id: `${companyId}:home`,
            companyId,
            status: 'placed',
            position: { locationId: hex, nodeId: 'city', slot: index }
        })
        if (terms.train) giveTrain(state, companyId, 'AE')
        const account = state.cash.find(
            (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
        )
        if (account) account.amount = 100
    }
    state.operatingSet = {
        number: 1,
        roundNumber: 1,
        roundCount: 1,
        companyOrder: [a, b],
        completedCompanyIds: [],
        privateIncomePaid: true,
        completed: false
    }
    state.trackStep = { companyId: a, lays: [], completed: false }
    state.machineState = 'LayingTrack'
    return { game, state, a, b }
}

const cash = (game: Table, owner: Owner) => finiteCashOwnedBy(game.state, owner)

describe('1862 mergers, as the rules’ examples play them', () => {
    it('Example #1: the N&E absorbs the WStI at £134', () => {
        const {
            game,
            state,
            a: ne,
            b: wsti
        } = twoCompanies({ price: 90, train: true }, { price: 90, train: true })
        hold(state, ne, [
            { owner: player('p1'), shares: 4 },
            { owner: player('p2'), shares: 3 },
            { owner: player('p3'), shares: 1 },
            { owner: { kind: 'company', companyId: ne }, shares: 2 }
        ])
        hold(state, wsti, [
            { owner: player('p1'), shares: 5 },
            { owner: player('p3'), shares: 1 },
            { owner: player('p4'), shares: 1 },
            { owner: { kind: 'company', companyId: wsti }, shares: 1 },
            { owner: 'pool', shares: 1 },
            { owner: 'ipo', shares: 1 }
        ])
        state.activePlayerIds = ['p1']
        game.state = state
        const before = ['p1', 'p2', 'p4'].map((id) => cash(game, player(id)))
        game.act('ProposeMerger', { companyId: ne, partnerId: wsti, survivorId: ne }, 'p1')
        expect(game.state.machineState).toBe('MergingShares')
        game.act('DecideOption', { redeem: true }, 'p1')
        game.act('DecideOption', { redeem: true }, 'p2')
        // The companies, as one, redeem their option from the joint treasury.
        game.act('DecideOption', { redeem: true }, 'p1')
        expect(game.state.machineState).toBe('LayingTrack')
        const held = (owner: Owner) => sharesOwned(game.state, ne, owner)
        expect(['p1', 'p2', 'p3', 'p4'].map((id) => held(player(id)))).toEqual([5, 2, 1, 0])
        expect(held({ kind: 'company', companyId: ne })).toBe(2)
        expect(Market1862Price(game, ne)).toBe(134)
        const after = ['p1', 'p2', 'p4'].map((id) => cash(game, player(id)))
        expect(after.map((amount, index) => amount - before[index])).toEqual([-67, -67, 67])
        expect(getCompany(game.state, wsti).started).toBeFalsy()
        expect(getCompany(game.state, ne).president).toEqual(player('p1'))
    })

    it('Example #2: the train-less N&E absorbs the I&B at £86', () => {
        const {
            game,
            state,
            a: ne,
            b: ib
        } = twoCompanies({ price: 100, train: false }, { price: 74, train: true })
        hold(state, ne, [
            { owner: player('p2'), shares: 4 },
            { owner: player('p4'), shares: 3 },
            { owner: player('p1'), shares: 1 },
            { owner: 'ipo', shares: 2 }
        ])
        hold(state, ib, [
            { owner: player('p2'), shares: 5 },
            { owner: player('p3'), shares: 3 },
            { owner: { kind: 'company', companyId: ib }, shares: 2 }
        ])
        state.trackStep = { companyId: ne, lays: [], completed: false }
        state.activePlayerIds = ['p2']
        game.state = state
        const treasury = cash(game, { kind: 'company', companyId: ib })
        const treasuryNe = cash(game, { kind: 'company', companyId: ne })
        game.act('ProposeMerger', { companyId: ne, partnerId: ib, survivorId: ne }, 'p2')
        for (const playerId of ['p2', 'p3', 'p4', 'p1'])
            game.act('DecideOption', { redeem: true }, playerId)
        const held = (owner: Owner) => sharesOwned(game.state, ne, owner)
        expect(['p1', 'p2', 'p3', 'p4'].map((id) => held(player(id)))).toEqual([1, 5, 2, 2])
        expect(held({ kind: 'company', companyId: ne })).toBe(0)
        expect(Market1862Price(game, ne)).toBe(86)
        expect(cash(game, { kind: 'company', companyId: ne })).toBe(treasury + treasuryNe + 86)
        expect(getCompany(game.state, ne).president).toEqual(player('p2'))
    })
})

function Market1862Price(game: Table, companyId: string): number {
    return Market1862.companySpace(game.state.stockMarket, companyId).price
}
