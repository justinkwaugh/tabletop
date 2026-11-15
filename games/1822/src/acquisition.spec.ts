import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    TrackConstruction,
    StationPlacement,
    getCompany,
    homeStationId,
    markTurn,
    placeStockMarker,
    privateTrackConstruction,
    sharesOwned,
    trainsOwnedBy
} from '@tabletop/18xx'
import { kit, prepared, type Table } from '../test/kit.js'
import {
    cashOf,
    company,
    giveCharter,
    layTiles,
    player,
    runMinor,
    setCash,
    spaceAt,
    stepTo
} from '../test/positions.js'
import { minorAcquisitions1822 } from './acquisition.js'
import { MetropolitanId, major1822 } from './companies.js'
import { RoundelSlot1822 } from './housekeeping.js'
import { Map1822 } from './map.js'
import { acquirablePrivates1822, acquisitionChoices1822 } from './privateAcquisition.js'
import { EnglishChannelLocationId } from './privates.js'
import { AdvancedLayMark, PrivatePowerRules1822, terrainCost1822 } from './privatePowers.js'
import type { State1822 } from './state.js'
import { StationRules1822 } from './stations.js'
import { exchangeTokens1822, placeExchangeToken1822, returnExchangeToken1822 } from './tokens.js'
import { EnglishChannelTileIds1822, Tiles1822 } from './tiles.js'
import { TrackRules1822 } from './track.js'

/**
 * The Caledonian with four treasury shares and the Lanarkshire & Dunbartonshire, one director.
 * Each earns nothing before the Caledonian buys trains, so they stand at £150 and £80 by then.
 */
function caledonian(extra: (state: State1822, first: string) => void = () => undefined): Table {
    return prepared((state, [first]) => {
        state.phaseId = '3'
        kit.operated(state, 'CR', first, { price: 100, shares: 6, cash: 400 })
        placeStockMarker(state.stockMarket, 'CR', spaceAt(165))
        runMinor(state, 'M2', first, { price: 90, cash: 70 })
        kit.giveTrain(state, 'CR', '2')
        kit.giveTrain(state, 'M2', '2')
        extra(state, first)
    })
}

describe('acquiring a minor company (§5.18)', () => {
    it('offers zero, one or two shares with cash either way to make up twice the minor’s value (§5.18.4)', () => {
        const game = caledonian()
        const [first] = game.state.turnManager.turnOrder
        stepTo(game, 'BuyingTrains', 'CR')
        const [offer] = minorAcquisitions1822(game.hydrated, first)
        expect(offer).toMatchObject({
            companyId: 'CR',
            minorId: 'M2',
            source: 'director',
            terms: [
                { shares: 0, payment: 160 },
                { shares: 1, payment: 10 },
                { shares: 2, payment: -140 }
            ],
            tokens: ['place', 'available'],
            excessTrains: 0
        })
    })

    it('takes the minor’s cash, trains and station, an exchange token standing where its station stood', () => {
        const game = caledonian()
        const [first] = game.state.turnManager.turnOrder
        stepTo(game, 'BuyingTrains', 'CR')
        const before = game.state
        const treasury = cashOf(before, company('CR'))
        const minorCash = cashOf(before, company('M2'))
        const directorCash = cashOf(before, player(first))
        game.act('AcquireMinor', {
            companyId: 'CR',
            minorId: 'M2',
            shares: 1,
            token: 'place',
            discardTrainIds: []
        })
        const state = game.hydrated
        expect(getCompany(state, 'M2').closed).toBe(true)
        expect(cashOf(game.state, company('CR'))).toBe(treasury - 10 + minorCash)
        expect(cashOf(game.state, player(first))).toBe(directorCash + 10)
        expect(sharesOwned(state, 'CR', player(first))).toBe(7)
        expect(trainsOwnedBy(state, company('CR'))).toHaveLength(2)
        expect(exchangeTokens1822(state, 'CR')).toBe(2)
        expect(
            state.stations.find(
                (station) => station.status === 'placed' && station.position.locationId === 'E2'
            )
        ).toMatchObject({ companyId: 'CR' })
        // One acquisition a turn (§5.18.1).
        expect(minorAcquisitions1822(state, first)).toEqual([])
        expect(game.valid(first)).not.toContain('BuyTrain')
    })

    it('opens the London roundel space to any company once the Metropolitan’s token leaves it (§5.10.4)', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '3'
            kit.operated(state, 'GWR', first, { price: 100, shares: 6, cash: 400 })
            runMinor(state, MetropolitanId, first)
            kit.giveTrain(state, 'GWR', '3')
            kit.giveTrain(state, MetropolitanId, '2')
            const home = major1822('GWR')?.home
            assertExists(home, 'The Great Western starts in London')
            state.stations = state.stations.map((station) =>
                station.id === homeStationId(MetropolitanId)
                    ? {
                          id: station.id,
                          companyId: MetropolitanId,
                          status: 'placed',
                          position: { ...home, slot: RoundelSlot1822 }
                      }
                    : station
            )
        })
        const [first] = game.state.turnManager.turnOrder
        const home = major1822('GWR')?.home
        assertExists(home, 'The Great Western starts in London')
        const openSlots = () =>
            new StationPlacement(game.hydrated, StationRules1822).openSlots(
                'CR',
                home.locationId,
                home.nodeId
            )
        expect(openSlots()).toEqual([])
        stepTo(game, 'BuyingTrains', 'GWR')
        const offer = minorAcquisitions1822(game.hydrated, first).find(
            (entry) => entry.minorId === MetropolitanId
        )
        assertExists(offer, 'The Great Western may acquire the Metropolitan')
        // A company holds one station in each of London's stations (§5.12.6).
        expect(offer.tokens).toEqual(['available'])
        game.act('AcquireMinor', {
            companyId: 'GWR',
            minorId: MetropolitanId,
            shares: offer.terms[0].shares,
            token: 'available',
            discardTrainIds: []
        })
        expect(openSlots()).toEqual([RoundelSlot1822])
    })

    it('is closed to a company in the operating round of its first turn (§5.18.1)', () => {
        const game = caledonian((state) => {
            getCompany(state, 'M2').operated = false
        })
        const [first] = game.state.turnManager.turnOrder
        stepTo(game, 'BuyingTrains', 'CR')
        expect(minorAcquisitions1822(game.hydrated, first)).toEqual([])
    })

    it('needs a route from the major to the minor’s home station (§5.18.1)', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '3'
            kit.operated(state, 'CR', first, { price: 100, shares: 6, cash: 400 })
            runMinor(state, 'M5', first, { price: 90 })
            kit.giveTrain(state, 'CR', '2')
            kit.giveTrain(state, 'M5', '2')
        })
        const [first] = game.state.turnManager.turnOrder
        stepTo(game, 'BuyingTrains', 'CR')
        expect(minorAcquisitions1822(game.hydrated, first)).toEqual([])
    })
})

describe('acquiring private companies (§3.1, §5.7)', () => {
    it('lets a company take its director’s privates from their phase on, red ones only a major', () => {
        const game = caledonian((state, first) => {
            giveCharter(state, 'P3', player(first))
            giveCharter(state, 'P8', player(first))
            giveCharter(state, 'P13', player(first))
            giveCharter(state, 'P16', player(first))
        })
        const [first] = game.state.turnManager.turnOrder
        stepTo(game, 'LayingTrack', 'M2')
        // P3 is red and P13 waits for phase 5; no company acquires the tax haven.
        expect(acquirablePrivates1822(game.hydrated, first).map((entry) => entry.id)).toEqual([
            'P8'
        ])
        stepTo(game, 'LayingTrack', 'CR')
        expect(acquirablePrivates1822(game.hydrated, first).map((entry) => entry.id)).toEqual([
            'P3',
            'P8'
        ])
        game.act('AcquirePrivate', { companyId: 'CR', privateCompanyId: 'P3' })
        expect(
            trainsOwnedBy(game.hydrated, company('CR'))
                .map((train) => train.definitionId)
                .sort()
        ).toEqual(['2', '2P'])
        game.act('AcquirePrivate', { companyId: 'CR', privateCompanyId: 'P8', choice: 'token' })
        expect(game.state.discountTokens).toEqual([{ companyId: 'CR', kind: 'terrain', count: 1 }])
        expect(getCompany(game.state, 'P8').closed).toBe(true)
    })

    it('asks another player for their private, which they give for nothing or keep (§3.1.2)', () => {
        const game = prepared((state, [first, second]) => {
            state.phaseId = '3'
            kit.operated(state, 'CR', first, { price: 100, shares: 6, cash: 400 })
            kit.giveTrain(state, 'CR', '2')
            giveCharter(state, 'P8', player(second))
            giveCharter(state, 'P2', player(second))
        })
        const [first, second] = game.state.turnManager.turnOrder
        stepTo(game, 'LayingTrack', 'CR')
        expect(acquirablePrivates1822(game.hydrated, first).map((entry) => entry.id)).toEqual([
            'P2',
            'P8'
        ])
        game.act('AcquirePrivate', { companyId: 'CR', privateCompanyId: 'P8', choice: 'token' })
        expect(game.state.privateOffer).toMatchObject({ playerId: second, privateCompanyId: 'P8' })
        expect(game.state.machineState).toBe('LayingTrack')
        expect(game.valid(first)).toEqual([])
        expect(game.valid(second)).toEqual(['AnswerPrivateOffer'])
        game.act('AnswerPrivateOffer', { accept: true }, second)
        expect(game.state.discountTokens).toEqual([{ companyId: 'CR', kind: 'terrain', count: 1 }])
        expect(game.state.activePlayerIds).toEqual([first])
        game.act('AcquirePrivate', { companyId: 'CR', privateCompanyId: 'P2' })
        game.act('AnswerPrivateOffer', { accept: false }, second)
        expect(game.actions.at(-1)).toMatchObject({
            type: 'AnswerPrivateOffer',
            metadata: { companyId: 'CR', privateCompanyId: 'P2' }
        })
        expect(getCompany(game.state, 'P2').closed).toBeFalsy()
        expect(acquirablePrivates1822(game.hydrated, first)).toEqual([])
        expect(game.state.activePlayerIds).toEqual([first])
    })

    it('hands a company P15’s credits and closes it', () => {
        const game = caledonian((state, first) => {
            giveCharter(state, 'P15', player(first))
            setCash(state, company('P15'), 90)
        })
        stepTo(game, 'LayingTrack', 'CR')
        const treasury = cashOf(game.state, company('CR'))
        game.act('AcquirePrivate', { companyId: 'CR', privateCompanyId: 'P15' })
        // The round's £30 was set aside on its charter before the company took it (Table 3).
        expect(cashOf(game.state, company('CR'))).toBe(treasury + 90 + 30)
        expect(getCompany(game.state, 'P15').closed).toBe(true)
    })

    it('takes £20 off hills and mountains for the company that chose P8’s discount', () => {
        const game = caledonian((state, first) => giveCharter(state, 'P8', player(first)))
        stepTo(game, 'LayingTrack', 'CR')
        game.act('AcquirePrivate', { companyId: 'CR', privateCompanyId: 'P8', choice: 'discount' })
        const state = game.hydrated
        const lay = (locationId: string) => ({
            companyId: 'CR',
            locationId,
            definitionId: '18xx:9',
            rotation: 0 as const,
            nodeMapping: {}
        })
        // H7 is hill terrain at £60; C42 is a £20 river, which the discount leaves alone.
        expect(terrainCost1822(state, lay('H7'), 60)).toBe(40)
        expect(terrainCost1822(state, lay('C42'), 20)).toBe(20)
    })
})

describe('P5 with the English Channel full (§3.1.17, §5.12.10)', () => {
    it('upgrades the Channel for £100 as the turn’s track and places an exchange token there', () => {
        const [green] = EnglishChannelTileIds1822
        const game = prepared((state, [first, second]) => {
            state.phaseId = '5'
            kit.operated(state, 'CR', first, { price: 100, shares: 6, cash: 400 })
            kit.operated(state, 'SECR', second, { price: 100, shares: 6 })
            kit.giveTrain(state, 'CR', '5')
            giveCharter(state, 'P5', player(first))
            layTiles(state, [
                { locationId: EnglishChannelLocationId, definitionId: green, rotation: 0 }
            ])
            const spare = state.stations.find(
                (station) => station.companyId === 'SECR' && station.status !== 'placed'
            )
            if (!spare) throw new Error('SECR has no spare station')
            state.stations = state.stations.map((station) =>
                station === spare
                    ? {
                          id: spare.id,
                          companyId: 'SECR',
                          status: 'placed',
                          position: {
                              locationId: EnglishChannelLocationId,
                              nodeId: 'city',
                              slot: 0
                          }
                      }
                    : station
            )
        })
        stepTo(game, 'LayingTrack', 'CR')
        expect(acquisitionChoices1822(game.hydrated, 'CR', 'P5')).toEqual(['upgrade', 'available'])
        const treasury = cashOf(game.state, company('CR'))
        const tokens = exchangeTokens1822(game.state, 'CR')
        game.act('AcquirePrivate', { companyId: 'CR', privateCompanyId: 'P5', choice: 'upgrade' })
        const state = game.state
        expect(cashOf(state, company('CR'))).toBe(treasury - 100)
        expect(state.tileInventory.placements[EnglishChannelLocationId].definitionId).toBe(
            EnglishChannelTileIds1822[1]
        )
        expect(exchangeTokens1822(state, 'CR')).toBe(tokens - 1)
        expect(
            state.stations.filter(
                (station) =>
                    station.status === 'placed' &&
                    station.position.locationId === EnglishChannelLocationId
            )
        ).toHaveLength(2)
        expect(state.trackStep?.lays).toEqual([
            { locationId: EnglishChannelLocationId, definitionId: EnglishChannelTileIds1822[1] }
        ])
        expect(getCompany(state, 'P5').closed).toBe(true)
    })
})

describe('P2 with P11 in one lay (§3.1.13)', () => {
    function laying(privates: readonly string[]): Table {
        const game = prepared((state, [first]) => {
            state.phaseId = '2'
            kit.operated(state, 'CR', first, { price: 100, shares: 6, cash: 400 })
            kit.giveTrain(state, 'CR', '2')
            for (const id of privates) giveCharter(state, id, company('CR'))
        })
        stepTo(game, 'LayingTrack', 'CR')
        return game
    }
    const plainGreen = {
        companyId: 'CR',
        locationId: 'test',
        definitionId: '18xx:80',
        rotation: 0 as const,
        nodeMapping: {},
        cost: 0,
        terrainCost: 0,
        allowanceCost: 0,
        movedStations: []
    }

    it('lets P2 lay plain track in the colour P11 brings early, closing both', () => {
        const game = laying(['P2', 'P11'])
        const state = game.hydrated
        const terms = PrivatePowerRules1822.trackTerms(state, 'P2', game.player)
        expect(terms?.colors).toEqual(['yellow', 'green'])
        expect(TrackRules1822.allowance(state, 'green')).toEqual({ cost: 0 })
        expect(PrivatePowerRules1822.afterTrackLay?.(state, 'P2', plainGreen)).toEqual({
            payments: [],
            closedPrivateIds: ['P2', 'P11']
        })
    })

    it('keeps P2 to the colours available without P11', () => {
        const game = laying(['P2'])
        const state = game.hydrated
        expect(PrivatePowerRules1822.trackTerms(state, 'P2', game.player)?.colors).toBeUndefined()
        expect(TrackRules1822.allowance(state, 'green')).toHaveProperty('reason')
    })
})

describe('P12 with P2 or P11 in one turn (Table 3)', () => {
    function laying(privates: readonly string[]): Table {
        const game = prepared((state, [first]) => {
            state.phaseId = '3'
            kit.operated(state, 'CR', first, { price: 100, shares: 6, cash: 400 })
            kit.giveTrain(state, 'CR', '2')
            for (const id of privates) giveCharter(state, id, company('CR'))
        })
        stepTo(game, 'LayingTrack', 'CR')
        return game
    }
    const extraLays = (game: Table) =>
        PrivatePowerRules1822.trackTerms(game.hydrated, 'P12', game.player)

    it('still adds P12’s extra lays, and the major’s second yellow tile, after P2’s plain track', () => {
        const game = laying(['P2', 'P12'])
        const state = structuredClone(game.state)
        // P2's plain yellow track was the first of the turn's two yellow tiles.
        state.trackStep = {
            companyId: 'CR',
            completed: false,
            lays: [{ locationId: 'test', definitionId: '18xx:9' }]
        }
        game.state = state
        expect(extraLays(game)).toBeDefined()
        expect(TrackRules1822.allowance(game.hydrated, 'yellow')).toEqual({ cost: 0 })
    })

    it('still adds P12’s extra lays after P11’s early upgrade took the turn’s track', () => {
        const game = laying(['P11', 'P12'])
        const state = game.hydrated
        markTurn(state, AdvancedLayMark)
        expect(TrackRules1822.allowance(state, 'yellow')).toHaveProperty('reason')
        const terms = PrivatePowerRules1822.trackTerms(state, 'P12', game.player)
        expect(terms?.definitionIds).toContain('18xx:9')
        expect(terms?.definitionIds).toContain('18xx:80')
    })

    type Lay = ReturnType<TrackConstruction['choices']>[number]
    /** The first yellow tile the construction can lay anywhere. */
    function yellowLay(construction: TrackConstruction): Lay {
        for (const location of Map1822.definition.locations) {
            const choice = construction
                .choices(location.id)
                .find(
                    (entry) =>
                        Tiles1822.find((tile) => tile.id === entry.definitionId)?.face.color ===
                        'yellow'
                )
            if (choice) return choice
        }
        throw new Error('No yellow tile to lay')
    }
    const request = ({ locationId, definitionId, rotation, nodeMapping, cost }: Lay) => ({
        companyId: 'CR',
        locationId,
        definitionId,
        rotation,
        nodeMapping,
        expectedCost: cost
    })
    function layOwn(game: Table) {
        const lay = yellowLay(new TrackConstruction(game.hydrated, TrackRules1822))
        game.act('LayTile', request(lay))
    }
    function layExtra(game: Table) {
        const terms = extraLays(game)
        if (!terms) throw new Error('P12 has no lay')
        const lay = yellowLay(privateTrackConstruction(game.hydrated, terms, TrackRules1822))
        game.act('LayPrivateTile', { ...request(lay), privateCompanyId: 'P12' })
    }

    it('ends the turn’s own track once P12’s extra tiles follow it (designer’s ruling)', () => {
        const game = laying(['P12'])
        layOwn(game)
        layExtra(game)
        expect(TrackRules1822.allowance(game.hydrated, 'yellow')).toHaveProperty('reason')
        // Its second extra tile still follows.
        expect(extraLays(game)).toBeDefined()
        layExtra(game)
        expect(getCompany(game.state, 'P12').closed).toBe(true)
    })

    it('gives up P12’s second tile once the turn’s own track follows its first', () => {
        const game = laying(['P12'])
        layExtra(game)
        expect(extraLays(game)).toBeDefined()
        layOwn(game)
        expect(extraLays(game)).toBeUndefined()
        // The turn's own second yellow tile is still to lay.
        expect(TrackRules1822.allowance(game.hydrated, 'yellow')).toEqual({ cost: 0 })
        game.act('FinishTrack', { companyId: 'CR' })
        expect(getCompany(game.state, 'P12').closed).toBe(true)
    })
})

describe('acquiring another director’s minor company (§5.18.1)', () => {
    /** The Caledonian under the first player and the minor under the second. */
    function twoDirectors(): Table {
        return prepared((state, [first, second]) => {
            state.phaseId = '3'
            kit.operated(state, 'CR', first, { price: 100, shares: 6, cash: 400 })
            placeStockMarker(state.stockMarket, 'CR', spaceAt(165))
            runMinor(state, 'M2', second, { price: 90, cash: 70 })
            kit.giveTrain(state, 'CR', '2')
            kit.giveTrain(state, 'M2', '2')
        })
    }
    const offer = { companyId: 'CR', minorId: 'M2', shares: 1, token: 'place', discardTrainIds: [] }

    it('waits for the minor’s director, who takes the shares and cash on agreeing', () => {
        const game = twoDirectors()
        const [first, second] = game.state.turnManager.turnOrder
        stepTo(game, 'BuyingTrains', 'CR')
        const sellerCash = cashOf(game.state, player(second))
        game.act('AcquireMinor', offer, first)
        expect(game.state.acquisitionOffer).toMatchObject({ playerId: second, minorId: 'M2' })
        expect(game.valid(first)).toEqual([])
        expect(game.valid(second)).toEqual(['AnswerAcquisition'])
        game.act('AnswerAcquisition', { accept: true }, second)
        const state = game.hydrated
        expect(getCompany(state, 'M2').closed).toBe(true)
        expect(sharesOwned(state, 'CR', player(second))).toBe(1)
        expect(cashOf(game.state, player(second))).toBe(sellerCash + 10)
        expect(state.acquisitionOffer).toBeUndefined()
        expect(state.activePlayerIds).toEqual([first])
    })

    it('leaves everything as it was when the director declines, and takes no second offer that turn', () => {
        const game = twoDirectors()
        const [first, second] = game.state.turnManager.turnOrder
        stepTo(game, 'BuyingTrains', 'CR')
        game.act('AcquireMinor', offer, first)
        game.act('AnswerAcquisition', { accept: false }, second)
        expect(game.actions.at(-1)).toMatchObject({
            type: 'AnswerAcquisition',
            metadata: { companyId: 'CR', minorId: 'M2', token: offer.token }
        })
        expect(getCompany(game.state, 'M2').closed).toBeFalsy()
        expect(game.state.activePlayerIds).toEqual([first])
        expect(minorAcquisitions1822(game.hydrated, first)).toEqual([])
    })
})

describe('exchange tokens (§5.6.3, §5.12.4, Table 3)', () => {
    it('never gives two stations one id, though P18 puts a token back between placements', () => {
        const state = caledonian().hydrated
        const first = placeExchangeToken1822(state, 'CR', {
            locationId: 'E2',
            nodeId: 'city',
            slot: 0
        })
        expect(exchangeTokens1822(state, 'CR')).toBe(2)
        const spare = state.stations.find(
            (station) => station.companyId === 'CR' && station.status === 'available'
        )
        assertExists(spare, 'The Caledonian has an available token')
        returnExchangeToken1822(state, spare.id)
        expect(exchangeTokens1822(state, 'CR')).toBe(3)
        const second = placeExchangeToken1822(state, 'CR', {
            locationId: 'H1',
            nodeId: 'city',
            slot: 0
        })
        expect(second).not.toBe(first)
        expect(new Set(state.stations.map((station) => station.id)).size).toBe(
            state.stations.length
        )
        expect(state.exchangeTokenUse).toEqual([{ companyId: 'CR', taken: 2, returned: 1 }])
    })

    it('records nothing for a company that has used none', () => {
        expect(caledonian().state.exchangeTokenUse).toEqual([])
        expect(exchangeTokens1822(caledonian().state, 'LNWR')).toBe(4)
        expect(exchangeTokens1822(caledonian().state, 'M2')).toBe(0)
    })
})
