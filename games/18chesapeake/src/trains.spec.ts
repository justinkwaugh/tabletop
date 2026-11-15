import { describe, expect, it } from 'vitest'
import { TrainPurchase, getCompany } from '@tabletop/18xx'
import { edit, floatCompany, kit, opened, setCash, type Table } from '../test/kit.js'
import { OperatingRulesChesapeake } from './operating.js'
import { TrainDepotChesapeake, TrainRulesChesapeake } from './trains.js'

const remaining = (game: Table, definitionId: string) =>
    TrainDepotChesapeake.remaining(game.state.trainInventory, definitionId)

/** Takes every train of these kinds out of the bank. */
function emptyDepot(game: Table, ...definitionIds: string[]): void {
    edit(game, (state) => {
        for (const definitionId of definitionIds)
            while (TrainDepotChesapeake.nextTrain(state.trainInventory, definitionId))
                TrainDepotChesapeake.export(state.trainInventory, definitionId)
    })
}

/** Plays the operating round out, each company finishing its turn at once. */
function finishOperatingRound(game: Table): void {
    while (game.state.machineState !== 'StockRound') {
        const companyId =
            game.state.trackStep?.companyId ??
            game.state.stationStep?.companyId ??
            game.state.trainPurchaseStep?.companyId ??
            ''
        if (game.state.machineState === 'LayingTrack') game.act('FinishTrack', { companyId })
        else if (game.state.machineState === 'PlacingStation')
            game.act('FinishStations', { companyId })
        else if (game.valid(game.player).includes('FinishTrains'))
            game.act('FinishTrains', { companyId })
        else game.act('FinishOperatingTurn', { companyId })
    }
}

describe('18Chesapeake trains', () => {
    it('exports the next 2-, 3- or 4-train at the end of each set, never a permanent one (§11.9)', () => {
        const game = opened(4)
        floatCompany(game, 'PRR')
        kit.passStockRound(game)
        expect(remaining(game, '2')).toBe(7)
        finishOperatingRound(game)
        expect(remaining(game, '2')).toBe(6)
        const exported = game.actions.findLast((action) => action.type === 'ExportTrains')
        expect(exported?.metadata).toMatchObject({ trains: [{ definitionId: '2' }] })

        const state = structuredClone(game.state)
        state.operatingSet = {
            number: 2,
            roundNumber: 2,
            roundCount: 2,
            companyOrder: [],
            completedCompanyIds: [],
            privateIncomePaid: true,
            completed: false
        }
        for (const definitionId of ['2', '3', '4'])
            while (TrainDepotChesapeake.nextTrain(state.trainInventory, definitionId))
                TrainDepotChesapeake.export(state.trainInventory, definitionId)
        expect(OperatingRulesChesapeake.trainsToExport?.(state)).toEqual([])
        state.operatingSet.roundNumber = 1
        expect(OperatingRulesChesapeake.trainsToExport?.(state)).toEqual([])
    })

    it('starts a phase when the export takes the first of a kind (§11.9)', () => {
        const game = opened(4)
        floatCompany(game, 'PRR')
        kit.passStockRound(game)
        emptyDepot(game, '2')
        finishOperatingRound(game)
        expect(game.state.phaseId).toBe('3')
        expect(remaining(game, '3')).toBe(5)
    })

    it('sells D-trains from the first 6-train, at $900 or $700 with a 4, 5 or 6 traded in (§11.7)', () => {
        const game = opened(4)
        floatCompany(game, 'PRR')
        kit.passStockRound(game)
        emptyDepot(game, '2', '3', '4', '5')
        edit(game, (state) => {
            state.phaseId = '6'
            const train = TrainDepotChesapeake.nextTrain(state.trainInventory, '6')
            if (!train) throw new Error('A 6-train is left')
            TrainDepotChesapeake.purchase(state.trainInventory, train.id, '6', {
                kind: 'company',
                companyId: 'PRR'
            })
            setCash(state, 'PRR', 2000)
            state.machineState = 'BuyingTrains'
            delete state.trackStep
            state.trainPurchaseStep = { companyId: 'PRR', purchasedTrainIds: [] }
        })
        const purchase = new TrainPurchase(game.hydrated, TrainRulesChesapeake)
        const offers = [
            ...purchase
                .offers()
                .flatMap((offer) => (offer.evaluation.details ? [offer.evaluation.details] : [])),
            ...purchase.exchanges()
        ]
        expect(offers.some((offer) => offer.definitionId === '6' && offer.price === 630)).toBe(true)
        expect(
            offers.some(
                (offer) =>
                    offer.definitionId === 'D' && offer.price === 900 && !offer.exchangeTrainId
            )
        ).toBe(true)
        expect(
            offers.some(
                (offer) =>
                    offer.definitionId === 'D' && offer.price === 700 && !!offer.exchangeTrainId
            )
        ).toBe(true)
    })

    it('closes Cornelius Vanderbilt when its company buys its first train (§7.1 P6)', () => {
        const game = opened(4)
        const drawn = game.state.corneliusCompanyId
        expect(TrainRulesChesapeake.privatesClosedByPurchase?.(game.hydrated, drawn)).toEqual([
            'CV'
        ])
        const other = drawn === 'PRR' ? 'LV' : 'PRR'
        expect(TrainRulesChesapeake.privatesClosedByPurchase?.(game.hydrated, other)).toEqual([])
        edit(game, (state) => {
            getCompany(state, 'CV').closed = true
        })
        expect(TrainRulesChesapeake.privatesClosedByPurchase?.(game.hydrated, drawn)).toEqual([])
    })
})
