import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    finiteCashOwnedBy,
    getCompany,
    locationMarkers,
    placeLocationMarker,
    placeStockMarker,
    privateTrackConstruction,
    sameOwner,
    type CompanyDecisionState,
    type EighteenXXState,
    type Owner
} from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import {
    EighteenSeventeenPrivatePowerRules,
    EighteenSeventeenRouteRules,
    EighteenSeventeenStockRules,
    EighteenSeventeenTrainDepot,
    EighteenSeventeenTrackRules,
    EighteenSeventeenTrainRules,
    InventorId,
    ScrapperId,
    recordPrivateLay,
    stationPurchase
} from './index.js'
import { mergerRoundCompanyId } from './mergerRound.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'
import { passUntil } from '../test/passTurns.js'
import { addPrivate } from '../test/privates.js'

const company = (companyId: string) => ({ kind: 'company' as const, companyId })
const player = (playerId: string) => ({ kind: 'player' as const, playerId })

const cash = (play: ExamplePlay, owner: Owner) => finiteCashOwnedBy(play.state, owner)

describe('the Loan Shark', () => {
    it('brings its company $60 at formation', () => {
        const play = playExample(EighteenSeventeenScenarios, 'trading', 3, (state) =>
            addPrivate(state, 'P12', player('alex'))
        )
        const terms = EighteenSeventeenStockRules.companyAuction
        assertExists(terms, '1817 starts companies by auction')
        const before = cash(play, company('NYSW'))
        terms.form(play.state, {
            companyId: 'NYSW',
            playerId: 'alex',
            price: 100,
            shareCount: 2,
            privateIds: ['P12'],
            marketSpaceId: '0:0'
        })
        expect(cash(play, company('NYSW'))).toBe(before + 100 - 60 + 60)
    })

    it('charges its company $10 interest each round without loans', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) =>
            addPrivate(state, 'P12', company('BA'))
        )
        const before = cash(play, company('BA'))
        play.act('FinishTrack', { companyId: 'BA' })
        play.act('FinishTrains', { companyId: 'BA' })
        expect(play.state.machineState).toBe('RepayingLoans')
        expect(cash(play, company('BA'))).toBe(before - 10)
    })
})

describe('the Loan Shark’s interest', () => {
    it('is owed with the loans’ when the company cannot pay at its limit', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            state.interestRate = 10
            getCompany(state, 'PLE').loans = 2
            addPrivate(state, 'P12', company('PLE'))
            for (const entry of state.cash)
                if (
                    sameOwner(entry.owner, company('PLE')) ||
                    sameOwner(entry.owner, player('alex'))
                )
                    entry.amount = 0
        })
        play.act('FinishTrack', { companyId: 'BA' })
        play.act('FinishTrains', { companyId: 'BA' })
        play.act('FinishOperatingTurn', { companyId: 'BA' })
        play.act('FinishTrack', { companyId: 'PLE' })
        // $20 on two loans at 10%, and the Loan Shark's $10.
        expect(play.state.cashCrisis?.debts).toEqual([{ playerId: 'alex', amount: 30 }])
    })
})

describe('the Ponzi Scheme', () => {
    it('closes when its company forms', () => {
        const play = playExample(EighteenSeventeenScenarios, 'trading', 3, (state) =>
            addPrivate(state, 'P13', player('alex'))
        )
        EighteenSeventeenStockRules.companyAuction?.form(play.state, {
            companyId: 'NYSW',
            playerId: 'alex',
            price: 100,
            shareCount: 2,
            privateIds: ['P13'],
            marketSpaceId: '0:0'
        })
        expect(getCompany(play.state, 'P13').closed).toBe(true)
    })
})

describe('the Inventor and the Scrapper', () => {
    function departing(privateId: string) {
        return playExample(EighteenSeventeenScenarios, 'construction', 3, (state) =>
            addPrivate(state, privateId, company('BA'))
        )
    }

    it('pays the Inventor’s company once for the first train of each type to leave', () => {
        const play = departing('P14')
        const depart = (definitionId: string) =>
            EighteenSeventeenTrainRules.afterTrainsDepart?.(play.state, [
                { trainId: `t${definitionId}`, definitionId, cause: 'purchase' }
            ])
        expect(depart('3')).toEqual([
            { from: { kind: 'bank' }, to: company('BA'), amount: 30, privateId: InventorId }
        ])
        expect(depart('3')).toEqual([])
        expect(depart('2+')).toEqual([])
    })

    it('pays the Inventor’s company when it buys the first train of a type', () => {
        const play = departing('P14')
        passUntil(play, (state) => state.machineState === 'BuyingTrains')
        const definitionId = EighteenSeventeenTrainDepot.nextDefinitionId(play.state.trainInventory)
        assertExists(definitionId, 'The depot has trains')
        const train = EighteenSeventeenTrainDepot.nextTrain(play.state.trainInventory, definitionId)
        assertExists(train, 'The depot has trains')
        const price = EighteenSeventeenTrainDepot.trainDefinition(definitionId).price
        const before = cash(play, company('BA'))
        play.act('BuyTrain', {
            companyId: 'BA',
            trainId: train.id,
            definitionId,
            expectedPrice: price
        })
        expect(cash(play, company('BA'))).toBe(before - price + 10 * Number(definitionId))
    })

    it('pays the Scrapper’s company for its own trains that rust', () => {
        const play = departing('P15')
        const rust = (owner: Owner) =>
            EighteenSeventeenTrainRules.afterTrainsDepart?.(play.state, [
                { trainId: 't', definitionId: '3', cause: 'rust', owner }
            ])
        expect(rust(company('BA'))).toEqual([
            { from: { kind: 'bank' }, to: company('BA'), amount: 75, privateId: ScrapperId }
        ])
        expect(rust(company('PLE'))).toEqual([])
    })
})

describe('the Scrapper in play', () => {
    it('is paid for each of its company’s 2s the export of the first 4 rusts', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            state.phaseId = '3'
            addPrivate(state, 'P15', company('BA'))
            const give = (definitionId: string) => {
                const index = state.trainInventory.trains.findIndex(
                    (train) => train.status === 'depot' && train.definitionId === definitionId
                )
                state.trainInventory.trains[index] = {
                    ...state.trainInventory.trains[index],
                    status: 'owned',
                    owner: company('BA')
                }
            }
            give('3')
            state.trainInventory.trains = state.trainInventory.trains.map((train) =>
                train.status === 'depot' && ['2', '2+', '3'].includes(train.definitionId)
                    ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                    : train
            )
        })
        const twos = play.state.trainInventory.trains.filter(
            (train) =>
                train.status === 'owned' &&
                sameOwner(train.owner, company('BA')) &&
                train.definitionId === '2'
        ).length
        passUntil(play, (state) => state.phaseId === '4')
        expect(play.state.phaseEvents.at(-1)?.departurePayments).toEqual(
            Array(twos).fill({
                from: { kind: 'bank' },
                to: company('BA'),
                amount: 30,
                privateId: ScrapperId
            })
        )
    })
})

describe('Express and Efficient Track', () => {
    const lay = {
        companyId: 'BA',
        locationId: 'B27',
        definitionId: '18xx:7',
        rotation: 0,
        nodeMapping: {}
    }

    it('make the first lay $10 and the second free', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) =>
            addPrivate(state, 'P18', company('BA'))
        )
        expect(EighteenSeventeenTrackRules.allowance(play.state, 'yellow')).toEqual({ cost: 10 })
        const before = cash(play, company('BA'))
        play.act('LayTile', { ...lay, expectedCost: 30 })
        expect(cash(play, company('BA'))).toBe(before - 30)
        expect(EighteenSeventeenTrackRules.allowance(play.state, 'yellow')).toEqual({ cost: 0 })
    })

    it('make both lays free together', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            addPrivate(state, 'P18', company('BA'))
            addPrivate(state, 'P19', company('BA'))
        })
        expect(EighteenSeventeenTrackRules.allowance(play.state, 'yellow')).toEqual({ cost: 0 })
        play.act('LayTile', { ...lay, expectedCost: 20 })
        expect(EighteenSeventeenTrackRules.allowance(play.state, 'yellow')).toEqual({ cost: 0 })
    })
})

describe('the Golden Parachute', () => {
    function acquired(withParachute: boolean) {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            if (withParachute) addPrivate(state, 'P20', company('PLE'))
        })
        passUntil(play, (state) => state.machineState === 'MergerRound')
        while (play.state.machineState === 'MergerRound')
            play.act('PassMerger', { companyId: mergerRoundCompanyId(play.state) })
        play.act('OfferCompany', { companyId: 'PLE' })
        play.act('BidToAcquire', { companyId: 'PLE', amount: 120 })
        return cash(play, player('alex'))
    }

    it('pays $100 to the president of a company another president’s company acquires', () => {
        expect(acquired(true)).toBe(acquired(false) + 100)
    })
})

describe('the Station Subsidy', () => {
    it('takes $50 off the stations its company buys when it converts', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) =>
            addPrivate(state, 'P21', company('PLE'))
        )
        expect(stationPurchase(play.state, 'PLE', 2).cost).toBe(50)
        expect(stationPurchase(play.state, 'PLE', 0).cost).toBe(0)
        expect(stationPurchase(play.state, 'BA', 2).cost).toBe(100)
    })
})

describe('ranches and the city-tile privates', () => {
    // Pittsburgh & Lake Erie lays from its home in Pittsburgh (F13), beside the ranch hex E14.
    function pittsburghTurn(prepare: (state: EighteenXXState) => void) {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, prepare)
        passUntil(play, (state) => state.trackStep?.companyId === 'PLE')
        return play
    }

    function privateLay(play: ExamplePlay, privateId: string, locationId: string) {
        const state: CompanyDecisionState = play.state
        const terms = EighteenSeventeenPrivatePowerRules.trackTerms(state, privateId, 'alex')
        assertExists(terms, 'The private can lay')
        const [details] = privateTrackConstruction(
            state,
            terms,
            EighteenSeventeenTrackRules
        ).choices(locationId)
        assertExists(details, 'The private has a lay here')
        play.act('LayPrivateTile', {
            privateCompanyId: privateId,
            companyId: 'PLE',
            locationId,
            definitionId: details.definitionId,
            rotation: details.rotation,
            nodeMapping: details.nodeMapping,
            expectedCost: details.cost
        })
    }

    it('lay a ranch that earns routes $10 and blocks upgrades', () => {
        const play = pittsburghTurn((state) => addPrivate(state, 'P22', company('PLE')))
        // A tile on Pittsburgh reaches toward the ranch hex E14.
        play.act('LayTile', {
            companyId: 'PLE',
            locationId: 'F13',
            definitionId: '18xx:5',
            rotation: 2,
            nodeMapping: { city: 'city' },
            expectedCost: 0
        })
        privateLay(play, 'P22', 'E14')
        expect(locationMarkers(play.state, { locationId: 'E14' })).toEqual([
            { locationId: 'E14', kind: 'ranch', privateCompanyId: 'P22' }
        ])
        expect(getCompany(play.state, 'P22').closed).toBe(true)
        expect(EighteenSeventeenRouteRules.hexBonus?.(play.state, 'E14')).toBe(10)
        expect(
            EighteenSeventeenTrackRules.restriction(play.state, {
                companyId: 'BA',
                locationId: 'E14',
                definitionId: '18xx:23',
                rotation: 0,
                nodeMapping: {}
            })
        ).toBe('Nobody may upgrade a ranch.')
    })

    it('lay X00 on their city without a connection, clearing the ranches beside it', () => {
        const play = pittsburghTurn((state) => {
            addPrivate(state, 'P24', company('PLE'))
            addPrivate(state, 'P23', company('PLE'))
            // The Rural Ranch has already made one of its lays, beside Indianapolis.
            placeLocationMarker(state, { locationId: 'E4', kind: 'ranch', privateCompanyId: 'P23' })
            recordPrivateLay(state, 'P23')
        })
        privateLay(play, 'P24', 'F3')
        expect(play.state.tileInventory.placements['F3']).toMatchObject({
            definitionId: '1817:X00'
        })
        expect(locationMarkers(play.state, { kind: 'ranch' })).toEqual([])
        expect(getCompany(play.state, 'P24').closed).toBe(true)
        const state: CompanyDecisionState = play.state
        const ranch = EighteenSeventeenPrivatePowerRules.trackTerms(state, 'P23', 'alex')
        assertExists(ranch, 'The Rural Ranch can lay')
        const reasons = [0, 1, 2, 3, 4, 5].map((rotation) =>
            ranch.restriction?.({
                companyId: 'PLE',
                locationId: 'E4',
                definitionId: '18xx:7',
                rotation,
                nodeMapping: {}
            })
        )
        expect(reasons).toContain('A ranch may not be laid beside a city tile.')
    })
})

describe('a bank liquidation', () => {
    // PLE runs a 3-train; the 2s exported after the round were paid for already.
    function liquidated(privateIds: readonly string[]) {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            placeStockMarker(state.stockMarket, 'PLE', '0:0')
            for (const privateId of privateIds) addPrivate(state, privateId, company('PLE'))
            Object.assign(state, { inventorPaid: ['2'] })
            const three = state.trainInventory.trains.findIndex(
                (train) => train.status === 'depot' && train.definitionId === '3'
            )
            state.trainInventory.trains = state.trainInventory.trains.map((train, index) =>
                index === three
                    ? { ...train, status: 'owned', owner: company('PLE') }
                    : train.status === 'owned' && sameOwner(train.owner, company('PLE'))
                      ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                      : train
            )
        })
        passUntil(play, (state) => state.machineState === 'MergerRound')
        while (play.state.machineState === 'MergerRound')
            play.act('PassMerger', { companyId: mergerRoundCompanyId(play.state) })
        const before = cash(play, company('PLE'))
        play.act('PassOnCompany', { companyId: 'PLE' })
        return { alex: cash(play, player('alex')), inventor: cash(play, company('PLE')) - before }
    }

    it('pays the Inventor for the company’s trains', () => {
        expect(liquidated(['P14']).inventor).toBe(30)
        expect(liquidated([]).inventor).toBe(0)
    })

    it('pays the Golden Parachute to the company’s president', () => {
        expect(liquidated(['P20']).alex).toBe(liquidated([]).alex + 100)
    })
})
