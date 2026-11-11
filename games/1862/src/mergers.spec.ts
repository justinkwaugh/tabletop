import {
    addCompanyStations,
    getCompany,
    sharesOwned,
    trainsOwnedBy,
    type Owner
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { Table } from '../test/kit.js'
import { cashOf as cash, hold, player, priceOf, treasury, twoCompanies } from '../test/positions.js'
import { Companies1862 } from './companies.js'
import { homeCity } from './homes.js'
import { isTakeMergeTurn, proposablePartners } from './mergers.js'
import type { State1862 } from './state.js'

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
        expect(priceOf(game, ne)).toBe(134)
        const after = ['p1', 'p2', 'p4'].map((id) => cash(game, player(id)))
        expect(after.map((amount, index) => amount - before[index])).toEqual([-67, -67, 67])
        expect(getCompany(game.state, wsti).started).toBeFalsy()
        expect(getCompany(game.state, ne).president).toEqual(player('p1'))
    })

    it('takes holders’ turns from the initiator clockwise, the companies as one last', () => {
        const {
            game,
            state,
            a: ne,
            b: wsti
        } = twoCompanies({ price: 90, train: true }, { price: 90, train: true })
        hold(state, ne, [
            { owner: player('p3'), shares: 6 },
            { owner: player('p4'), shares: 1 },
            { owner: player('p1'), shares: 1 },
            { owner: { kind: 'company', companyId: ne }, shares: 1 }
        ])
        hold(state, wsti, [
            { owner: player('p2'), shares: 3 },
            { owner: player('p3'), shares: 1 },
            { owner: { kind: 'company', companyId: wsti }, shares: 2 }
        ])
        state.activePlayerIds = ['p3']
        game.state = state
        game.act('ProposeMerger', { companyId: ne, partnerId: wsti, survivorId: ne }, 'p3')
        game.act('AnswerMerger', { accept: true }, 'p2')
        const holders = () => game.actions.filter(isTakeMergeTurn).map((action) => action.holder)
        expect(holders()).toEqual([player('p3')])
        expect(game.state.shareMerge?.option?.holder).toEqual(player('p3'))
        game.act('DecideOption', { redeem: true }, 'p3')
        expect(game.state.shareMerge?.option?.holder).toEqual(player('p4'))
        game.act('DecideOption', { redeem: true }, 'p4')
        expect(game.state.shareMerge?.option?.holder).toEqual(player('p1'))
        game.act('DecideOption', { redeem: true }, 'p1')
        expect(game.state.shareMerge?.option?.holder).toEqual(player('p2'))
        game.act('DecideOption', { redeem: true }, 'p2')
        expect(game.state.shareMerge?.option?.holder).toEqual({ kind: 'company', companyId: ne })
        game.act('DecideOption', { redeem: true }, 'p3')
        expect(holders()).toEqual([
            player('p3'),
            player('p4'),
            player('p1'),
            player('p2'),
            { kind: 'company', companyId: ne }
        ])
        expect(game.state.shareMerge).toBeUndefined()
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
        expect(priceOf(game, ne)).toBe(86)
        expect(cash(game, { kind: 'company', companyId: ne })).toBe(treasury + treasuryNe + 86)
        expect(getCompany(game.state, ne).president).toEqual(player('p2'))
    })
})

/** Every holder declines their option share until the share merge completes. */
function declineOptions(game: Table) {
    while (game.state.machineState === 'MergingShares')
        game.act('DecideOption', { redeem: false }, game.player)
}

describe('1862 acquisitions (§5.1.2, §7.14)', () => {
    function atTurnEnd(trains: { operating: boolean; partner: boolean }) {
        const { game, state, a, b } = twoCompanies(
            { price: 90, train: trains.operating },
            { price: 90, train: trains.partner },
            'BuyingTrains'
        )
        hold(state, a, [{ owner: player('p1'), shares: 6 }])
        hold(state, b, [{ owner: player('p1'), shares: 6 }])
        state.activePlayerIds = ['p1']
        game.state = state
        return { game, a, b }
    }

    it.each([
        { operating: true, partner: false, acquires: true },
        { operating: false, partner: true, acquires: true },
        { operating: true, partner: true, acquires: true },
        { operating: false, partner: false, acquires: false }
    ])(
        'needs a train in either company, not both: operating $operating, partner $partner',
        ({ operating, partner, acquires }) => {
            const { game, a, b } = atTurnEnd({ operating, partner })
            expect(proposablePartners(game.state, 'p1', a)).toEqual(acquires ? [b] : [])
            expect(game.valid('p1').includes('ProposeMerger')).toBe(acquires)
        }
    )

    it('lets a train-less company merge at its turn’s start without either train', () => {
        const { game, state, a, b } = twoCompanies(
            { price: 90, train: false },
            { price: 90, train: false }
        )
        hold(state, a, [{ owner: player('p1'), shares: 6 }])
        hold(state, b, [{ owner: player('p1'), shares: 6 }])
        state.activePlayerIds = ['p1']
        game.state = state
        expect(proposablePartners(game.state, 'p1', a)).toEqual([b])
    })

    it('ends the train-less acquirer’s turn holding the train it acquired', () => {
        const { game, a, b } = atTurnEnd({ operating: false, partner: true })
        game.act('ProposeMerger', { companyId: a, partnerId: b, survivorId: a }, 'p1')
        declineOptions(game)
        expect(trainsOwnedBy(game.state, treasury(a))).toHaveLength(1)
        expect(getCompany(game.state, b).started).toBeFalsy()
        expect(game.state.trainPurchaseStep).toBeUndefined()
        expect(game.state.operatingSet?.completedCompanyIds).toContain(a)
    })
})

describe('1862 stations beyond the limit after a merger (§7.5.6)', () => {
    /** Places a new station of the company in another company's home city. */
    function placeElsewhere(state: State1862, companyId: string, homeOf: string) {
        addCompanyStations(state, companyId, 1)
        const added = state.stations.at(-1)
        assertExists(added, 'The company gains a station')
        const city = homeCity(state, homeOf)
        state.stations = state.stations.map((station) =>
            station.id === added.id
                ? {
                      id: station.id,
                      companyId,
                      status: 'placed',
                      position: { locationId: city.locationId, nodeId: city.nodeId, slot: 0 }
                  }
                : station
        )
        return city.locationId
    }

    /**
     * The survivor has its home, three stations placed elsewhere and one unused; the other its
     * home in the same city and four placed elsewhere: nine between them once merged.
     */
    function mergeNineStations(variants: State1862['variants']) {
        const { game, state, a, b } = twoCompanies(
            { price: 90, train: true },
            { price: 90, train: true }
        )
        hold(state, a, [{ owner: player('p1'), shares: 6 }])
        hold(state, b, [{ owner: player('p1'), shares: 6 }])
        state.variants = variants
        const elsewhere = Companies1862.map((company) => company.id)
            .filter((id) => id !== a && id !== b && homeCity(state, id).locationId !== 'D11')
            .slice(0, 7)
        const survivorHexes = elsewhere.slice(0, 3).map((id) => placeElsewhere(state, a, id))
        addCompanyStations(state, a, 1)
        const otherHexes = elsewhere.slice(3).map((id) => placeElsewhere(state, b, id))
        state.activePlayerIds = ['p1']
        game.state = state
        game.act('ProposeMerger', { companyId: a, partnerId: b, survivorId: a }, 'p1')
        declineOptions(game)
        const kept = game.state.stations.filter(
            (station) => station.companyId === a && station.status !== 'removed'
        )
        const placedHexes = kept.flatMap((station) =>
            station.status === 'placed' ? [station.position.locationId] : []
        )
        return { kept, placedHexes, survivorHexes, otherHexes }
    }

    it('removes the unused station, then the last placed, down to seven', () => {
        const { kept, placedHexes, survivorHexes, otherHexes } = mergeNineStations({})
        expect(kept).toHaveLength(7)
        expect(kept.every((station) => station.status === 'placed')).toBe(true)
        expect(placedHexes.sort()).toEqual(
            ['D11', ...survivorHexes, ...otherHexes.slice(0, 3)].sort()
        )
    })

    it('keeps eight with the eight-station variant, removing only the unused station', () => {
        const { kept, placedHexes, survivorHexes, otherHexes } = mergeNineStations({
            eightStations: true
        })
        expect(kept).toHaveLength(8)
        expect(kept.every((station) => station.status === 'placed')).toBe(true)
        expect(placedHexes.sort()).toEqual(['D11', ...survivorHexes, ...otherHexes].sort())
    })
})
