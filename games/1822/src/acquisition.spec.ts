import { describe, expect, it } from 'vitest'
import { getCompany, placeStockMarker, sharesOwned, trainsOwnedBy } from '@tabletop/18xx'
import { kit, type Table } from '../test/kit.js'
import {
    cashOf,
    company,
    giveCharter,
    player,
    runMinor,
    setCash,
    spaceAt,
    stepTo
} from '../test/positions.js'
import { minorAcquisitions1822 } from './acquisition.js'
import { acquirablePrivates1822 } from './privateAcquisition.js'
import { terrainCost1822 } from './privatePowers.js'
import type { State1822 } from './state.js'
import { exchangeTokens1822 } from './tokens.js'

function prepared(prepare: (state: State1822, players: string[]) => void): Table {
    const game = kit.table(4, 3)
    const state = structuredClone(game.state)
    state.stockRound.number = 2
    prepare(state, state.turnManager.turnOrder)
    game.state = state
    return game
}

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
