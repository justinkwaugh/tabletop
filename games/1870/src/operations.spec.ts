import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    TrackConstruction,
    finiteCashOwnedBy,
    getCompany,
    privateOwner,
    privateTrackConstruction,
    type TrackLayDetails
} from '@tabletop/18xx'
import { exits, giveTrain, lay, operated, prepared, type Table } from '../test/kit.js'
import { Map1870 } from './map.js'
import { EarningsRules1870, PrivatePowerRules1870, TransferRules1870 } from './operating.js'
import { Market1870 } from './stockMarket.js'
import type { State1870 } from './state.js'
import type { RevenueToken } from './titleState.js'
import { stopBonuses } from './tokens.js'
import { TrackRules1870, riverClosed } from './track.js'
import { revenueStages, Phases1870 } from './trains.js'

function ownPrivate(state: State1870, privateId: string, companyId: string) {
    const certificate = state.certificates.find((entry) => entry.id === `${privateId}:charter`)
    assertExists(certificate, 'The private has a charter')
    certificate.owner = { kind: 'company', companyId }
}

function treasury(game: Table, companyId: string): number {
    return finiteCashOwnedBy(game.state, { kind: 'company', companyId })
}

function toCompanyTurn(game: Table, companyId: string) {
    while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
    expect(game.state.machineState).toBe('LayingTrack')
    expect(game.state.trackStep?.companyId).toBe(companyId)
}

describe('half dividends (p. 20)', () => {
    it('leave the company half, rounded up to $10, and pay the rest by share', () => {
        const retained = EarningsRules1870.retainedRevenue
        const prepare = prepared((state) => operated(state, 'IC', 'p1'))
        const state = prepare.hydrated
        expect(retained(state, 'IC', 'half-pay', 130)).toBe(70)
        expect(retained(state, 'IC', 'half-pay', 120)).toBe(60)
        expect(retained(state, 'IC', 'withhold', 130)).toBe(130)
        expect(retained(state, 'IC', 'pay', 130)).toBe(0)
    })

    it('keep the price where it is; a full dividend moves right, a withheld one left', () => {
        const prepare = prepared((state) => operated(state, 'IC', 'p1'))
        const state = prepare.hydrated
        const effect = (choice: 'pay' | 'half-pay' | 'withhold') =>
            EarningsRules1870.marketEffect(state, 'IC', {
                choice,
                revenue: 100,
                retained: choice === 'pay' ? 0 : choice === 'withhold' ? 100 : 50,
                baseDividendPerShare: 10
            }).move
        expect(effect('half-pay')).toBeUndefined()
        const priceAfter = (choice: 'pay' | 'withhold') => {
            const move = effect(choice)
            assertExists(move, 'The dividend moves the price')
            return Market1870.space(move.toMarketSpaceId).price
        }
        expect(priceAfter('pay')).toBe(110)
        expect(priceAfter('withhold')).toBe(90)
    })
})

describe('phases (pp. 4-6)', () => {
    it('reads red off-board values top to the 4s, middle to the 6s, then bottom', () => {
        expect(revenueStages('4')).toEqual(['yellow'])
        expect(revenueStages('5')).toEqual(['yellow', 'brown'])
        expect(revenueStages('6')).toEqual(['yellow', 'brown'])
        expect(revenueStages('8')).toEqual(['yellow', 'brown', 'gray'])
        expect(revenueStages('D')).toEqual(['yellow', 'brown', 'gray'])
    })

    it('scraps 2s with the first 4, 3s with the 6, 4s with the 8 and 5s with the 12', () => {
        expect(Phases1870.rustTiming('4', '2')).toBe('immediate')
        expect(Phases1870.rustTiming('3', '2')).toBeUndefined()
        expect(Phases1870.rustTiming('6', '3')).toBe('immediate')
        expect(Phases1870.rustTiming('8', '4')).toBe('immediate')
        expect(Phases1870.rustTiming('12', '5')).toBe('immediate')
        expect(Phases1870.rustTiming('12', '6')).toBeUndefined()
    })

    it('limits trains and rounds as the table says', () => {
        expect(['2', '3', '4', '5', '6'].map((id) => Phases1870.phase(id).trainLimit)).toEqual([
            4, 4, 3, 2, 2
        ])
        expect(['2', '3', '4', '5'].map((id) => Phases1870.phase(id).operatingRounds)).toEqual([
            1, 2, 2, 3
        ])
    })
})

describe('buying privates (pp. 8, 18)', () => {
    const asset = (privateCompanyId: string) => ({ kind: 'private' as const, privateCompanyId })
    const range = (phaseId: string, companyId: string, privateId: string) => {
        const game = prepared((state) => {
            state.phaseId = phaseId
        })
        return TransferRules1870.priceRange(game.hydrated, companyId, asset(privateId))
    }
    it('allows only the bridge to the river companies before the 3s, for $20 to $40', () => {
        expect(range('2', 'MP', 'MRBC')).toEqual({ minimum: 20, maximum: 40 })
        expect(range('2', 'SSW', 'MRBC')).toEqual({ minimum: 20, maximum: 40 })
        expect(range('2', 'IC', 'MRBC')).toBeUndefined()
        expect(range('2', 'MP', 'GRSC')).toBeUndefined()
    })
    it('allows any private for half to double from the 3s, none from the 5s', () => {
        expect(range('3', 'IC', 'MRBC')).toEqual({ minimum: 20, maximum: 80 })
        expect(range('4', 'IC', 'GSC')).toEqual({ minimum: 40, maximum: 160 })
        expect(range('5', 'IC', 'GSC')).toBeUndefined()
    })
    it('lets companies buy each other’s trains for at least $1', () => {
        const game = prepared(() => undefined)
        expect(
            TransferRules1870.priceRange(game.hydrated, 'IC', { kind: 'train', trainId: 'x' })
        ).toEqual({ minimum: 1 })
    })
})

describe('the bridge company (p. 9)', () => {
    function river(companyId: string, operatedYet: boolean) {
        const game = prepared((state) => {
            operated(state, companyId, state.players[0].playerId)
            getCompany(state, companyId).operated = operatedYet
            ownPrivate(state, 'MRBC', companyId)
            giveTrain(state, companyId, '2')
        })
        toCompanyTurn(game, companyId)
        return game
    }

    it('opens the river once a company owns it', () => {
        const game = river('MP', true)
        expect(riverClosed(game.hydrated)).toBe(false)
        const closed = prepared(() => undefined)
        expect(privateOwner(closed.state, 'MRBC')?.kind).toBe('player')
        expect(riverClosed(closed.hydrated)).toBe(true)
    })

    it('takes $40 off one river hex for its owner', () => {
        const game = river('MP', true)
        const terms = PrivatePowerRules1870.trackTerms(game.hydrated, 'MRBC', game.player)
        expect(terms?.terrainDiscount).toBe(40)
        expect(terms?.countsAsOrdinaryLay).toBeUndefined()
        expect(terms?.locationIds).toContain('H17')
    })

    it('gives a river company buying it in its first round a free lay at home, besides', () => {
        const game = river('SSW', false)
        const terms = PrivatePowerRules1870.trackTerms(game.hydrated, 'MRBC', game.player)
        expect(terms?.free).toBe(true)
        expect(terms?.locationIds).toEqual(['H17'])
        expect(terms?.countsAsOrdinaryLay).toBeUndefined()
    })

    function layBridgeTile(game: Table, locationId: string) {
        const terms = PrivatePowerRules1870.trackTerms(game.hydrated, 'MRBC', game.player)
        assertExists(terms, 'The bridge offers a lay')
        const choice = privateTrackConstruction(game.hydrated, terms, TrackRules1870).choices(
            locationId
        )[0]
        assertExists(choice, `The bridge lays in ${locationId}`)
        game.act('LayPrivateTile', {
            privateCompanyId: 'MRBC',
            companyId: choice.companyId,
            locationId,
            definitionId: choice.definitionId,
            rotation: choice.rotation,
            nodeMapping: choice.nodeMapping,
            expectedCost: choice.cost
        })
        return choice
    }

    it('lays the starting city free, once, and besides the ordinary lays', () => {
        const game = river('SSW', false)
        const cash = treasury(game, 'SSW')
        expect(layBridgeTile(game, 'H17').cost).toBe(0)
        expect(treasury(game, 'SSW')).toBe(cash)
        expect(game.state.trackStep?.lays).toEqual([])
        expect(getCompany(game.state, 'MRBC').closed).toBeFalsy()
        expect(game.valid()).not.toContain('LayPrivateTile')
    })

    it('cannot upgrade the free starting city in the same operating round', () => {
        const game = river('SSW', false)
        layBridgeTile(game, 'H17')
        game.state.phaseId = '3'
        const hasGreen = new TrackConstruction(game.hydrated, TrackRules1870).choices('H17')
        expect(hasGreen).toEqual([])
    })

    it('leaves the other river company’s starting city alone', () => {
        const game = prepared((state) => {
            operated(state, 'SSW', state.players[0].playerId)
            getCompany(state, 'SSW').operated = false
            operated(state, 'MP', state.players[1].playerId)
            ownPrivate(state, 'MRBC', 'MP')
            state.usedPrivatePowerIds?.push('MRBC')
            giveTrain(state, 'SSW', '2')
            state.phaseId = '3'
        })
        toCompanyTurn(game, 'SSW')
        expect(new TrackConstruction(game.hydrated, TrackRules1870).choices('H17')).not.toEqual([])
    })

    it('lets a river company whose starting city is built take the discount instead', () => {
        const game = river('SSW', false)
        lay(game, 'H17', '18xx:6', [1, 3])
        const terms = PrivatePowerRules1870.trackTerms(game.hydrated, 'MRBC', game.player)
        expect(terms?.free).toBeUndefined()
        expect(terms?.terrainDiscount).toBe(40)
    })

    function laidBridgeHex(game: Table) {
        lay(game, 'H17', '18xx:6', [1, 3])
        const neighbour = Map1870.neighbor('H17', 3)?.id
        assertExists(neighbour, 'The river runs on')
        const full = new TrackConstruction(game.hydrated, TrackRules1870).choices(neighbour)[0]
        const cash = treasury(game, 'SSW')
        const discounted = layBridgeTile(game, neighbour)
        expect(discounted.cost).toBe(full.cost - 40)
        expect(treasury(game, 'SSW')).toBe(cash - discounted.cost)
        return neighbour
    }

    it('takes the discount besides the ordinary lays, once, leaving the private open', () => {
        const game = river('SSW', true)
        laidBridgeHex(game)
        expect(game.state.trackStep?.lays).toHaveLength(1)
        expect(getCompany(game.state, 'MRBC').closed).toBeFalsy()
        expect(game.valid()).not.toContain('LayPrivateTile')
    })

    it('stays open after the two ordinary yellow lays', () => {
        const game = river('SSW', true)
        lay(game, 'H17', '18xx:6', [1, 3])
        const west = Map1870.neighbor('H17', 1)?.id
        assertExists(west, 'The river runs on')
        const second = new TrackConstruction(game.hydrated, TrackRules1870).choices(west)[0]
        lay(game, west, second.definitionId, exits(second.definitionId, second.rotation))
        expect(game.state.trackStep?.lays).toHaveLength(2)
        expect(game.valid()).toContain('LayPrivateTile')
        const neighbour = Map1870.neighbor('H17', 3)?.id
        assertExists(neighbour, 'The river runs on')
        layBridgeTile(game, neighbour)
        expect(game.state.trackStep?.lays).toHaveLength(2)
    })

    it('cannot upgrade the discounted tile in the same operating round', () => {
        const game = river('SSW', true)
        const state = structuredClone(game.state)
        state.phaseId = '3'
        game.state = state
        const hex = laidBridgeHex(game)
        const choices = () => new TrackConstruction(game.hydrated, TrackRules1870).choices(hex)
        expect(choices()).toEqual([])
    })

    it('frees the bridge tile for upgrading once the track step ends', () => {
        const game = river('SSW', true)
        const hex = laidBridgeHex(game)
        expect(game.state.bridgeLayLocationId).toBe(hex)
        game.act('FinishTrack', { companyId: 'SSW' })
        expect(game.state.bridgeLayLocationId).toBeUndefined()
    })

    it('makes crossing the river illegal for tiles while player-owned', () => {
        const game = prepared((state) => {
            operated(state, 'SSW', state.players[0].playerId, { cash: 500 })
            giveTrain(state, 'SSW', '2')
        })
        toCompanyTurn(game, 'SSW')
        const choices = new TrackConstruction(game.hydrated, TrackRules1870).choices('H17')
        const exits = (choice: TrackLayDetails) => choice.rotation
        expect(choices.length).toBeGreaterThan(0)
        expect(new Set(choices.map(exits)).size).toBeLessThan(6)
    })
})

describe('cattle and port tokens (p. 9)', () => {
    const tokens = (kind: RevenueToken['kind']): RevenueToken[] => [
        { kind, companyId: 'IC', locationId: 'N17', placedInRound: [1, 1] }
    ]
    it('adds $10 for the Cattle token’s company alone', () => {
        expect(stopBonuses(tokens('cattle'), 'IC', 'N17')).toEqual([
            { amount: 10, sourceId: 'cattle' }
        ])
        expect(stopBonuses(tokens('cattle'), 'MP', 'N17')).toEqual([])
    })
    it('adds $20 for a port’s company, and $10 for others while it is open', () => {
        expect(stopBonuses(tokens('open-port'), 'IC', 'N17')[0].amount).toBe(20)
        expect(stopBonuses(tokens('open-port'), 'MP', 'N17')[0].amount).toBe(10)
        expect(stopBonuses(tokens('closed-port'), 'IC', 'N17')[0].amount).toBe(20)
        expect(stopBonuses(tokens('closed-port'), 'MP', 'N17')).toEqual([])
    })

    function owning(privateId: string) {
        const game = prepared((state) => {
            operated(state, 'IC', state.players[0].playerId)
            ownPrivate(state, privateId, 'IC')
            giveTrain(state, 'IC', '2')
        })
        toCompanyTurn(game, 'IC')
        return game
    }

    it('places the Cattle token once, leaving the private open', () => {
        const game = owning('SCC')
        expect(game.valid()).toContain('PlaceRevenueToken')
        game.act('PlaceRevenueToken', { companyId: 'IC', kind: 'cattle', locationId: 'B9' })
        expect(game.state.revenueTokens).toHaveLength(1)
        expect(getCompany(game.state, 'SCC').closed).toBeFalsy()
        expect(game.valid()).not.toContain('PlaceRevenueToken')
    })

    it('refuses a Cattle token on the river', () => {
        const game = owning('SCC')
        expect(() =>
            game.act('PlaceRevenueToken', { companyId: 'IC', kind: 'cattle', locationId: 'H17' })
        ).toThrow()
    })

    it('closes the Gulf Shipping Company with a closed port', () => {
        const game = owning('GSC')
        game.act('PlaceRevenueToken', { companyId: 'IC', kind: 'closed-port', locationId: 'N17' })
        expect(getCompany(game.state, 'GSC').closed).toBe(true)
    })

    it('holds an open port’s closing for a later operating round', () => {
        const game = owning('GSC')
        game.act('PlaceRevenueToken', { companyId: 'IC', kind: 'open-port', locationId: 'N17' })
        expect(getCompany(game.state, 'GSC').closed).toBeFalsy()
        expect(() =>
            game.act('PlaceRevenueToken', {
                companyId: 'IC',
                kind: 'closed-port',
                locationId: 'N17'
            })
        ).toThrow()
    })
})
