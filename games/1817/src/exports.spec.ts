import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    placeStockMarker,
    stockMarketOrder,
    unownedTrain,
    type EighteenXXState,
    type Train
} from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenSeventeenTrainDepot } from './index.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'
import { passUntil } from '../test/passTurns.js'

const roundOf = (number: number, roundNumber: number) => (state: EighteenXXState) =>
    state.operatingSet?.number === number && state.operatingSet.roundNumber === roundNumber

const depot = (state: EighteenXXState, definitionId: string) =>
    state.trainInventory.trains.filter(
        (train) => train.status === 'depot' && train.definitionId === definitionId
    )

const removed = (state: EighteenXXState) =>
    state.trainInventory.trains
        .filter((train) => train.status === 'removed')
        .map((train) => train.definitionId)

// As though the trains were bought and scrapped earlier, keeping the first `keep` in the depot.
function removeFromDepot(state: EighteenXXState, definitionId: string, keep = 0) {
    let kept = 0
    state.trainInventory.trains = state.trainInventory.trains.map((train) => {
        if (train.status !== 'depot' || train.definitionId !== definitionId) return train
        if (kept++ < keep) return train
        return unownedTrain(train, 'removed')
    })
}

const ownedBy = (state: EighteenXXState, companyId: string) =>
    state.trainInventory.trains.filter(
        (train) =>
            train.status === 'owned' &&
            train.owner.kind === 'company' &&
            train.owner.companyId === companyId
    )

function give(state: EighteenXXState, companyId: string, definitionId: string): Train {
    const index = state.trainInventory.trains.findIndex(
        (train) => train.status === 'depot' && train.definitionId === definitionId
    )
    const train: Train = {
        id: state.trainInventory.trains[index].id,
        definitionId,
        status: 'owned',
        owner: { kind: 'company', companyId }
    }
    state.trainInventory.trains[index] = train
    return train
}

describe('train exports', () => {
    it('exports every 2 after the first round, then one train after each round', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3)
        const depotTwos = depot(play.state, '2').length
        passUntil(play, roundOf(1, 2))
        expect(depot(play.state, '2')).toEqual([])
        expect(removed(play.state)).toEqual(Array(depotTwos).fill('2'))
        expect(play.state.phaseId).toBe('2')

        passUntil(play, (state) => state.machineState === 'StockRound')
        expect(removed(play.state).slice(depotTwos)).toEqual(['2+'])
        expect(play.state.phaseId).toBe('2+')

        passUntil(play, roundOf(2, 2))
        expect(removed(play.state).slice(depotTwos)).toEqual(['2+', '2+'])
    })

    it('changes phase by export, rusting and obsoleting trains and enforcing the new limit', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            state.phaseId = '3'
            placeStockMarker(state.stockMarket, 'PLE', '0:18')
            state.trainInventory.trains = state.trainInventory.trains.map((train) =>
                train.status === 'owned' ? unownedTrain(train, 'removed') : train
            )
            give(state, 'PLE', '2+')
            for (const companyId of ['BA', 'PLE'])
                for (let count = 0; count < 3; count++) give(state, companyId, '3')
            give(state, 'BA', '3')
            for (const definitionId of ['2', '2+', '3']) removeFromDepot(state, definitionId)
        })
        expect(stockMarketOrder(play.state.stockMarket).slice(0, 2)).toEqual(['PLE', 'BA'])
        passUntil(play, (state) => state.machineState === 'DiscardingTrains')
        expect(play.state.phaseId).toBe('4')
        expect(removed(play.state).filter((id) => id === '4')).toHaveLength(1)
        expect(play.state.phaseChange?.discardCompanyIds).toEqual(['BA', 'PLE'])
        expect(ownedBy(play.state, 'PLE').find((train) => train.definitionId === '2+')).toEqual(
            expect.objectContaining({ rustsAfterOperation: true })
        )
        passUntil(play, (state) => state.machineState === 'StockRound')
        expect(ownedBy(play.state, 'BA')).toHaveLength(3)
        expect(ownedBy(play.state, 'PLE')).toHaveLength(3)
    })
})

describe('the first 8-train', () => {
    function eightAfterRound(roundNumber: number) {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            state.phaseId = '7'
            for (const definitionId of ['2', '2+', '3', '4', '5', '6'])
                removeFromDepot(state, definitionId)
            removeFromDepot(state, '7', roundNumber === 2 ? 1 : 0)
        })
        passUntil(play, roundOf(1, 2))
        return play
    }

    it('ends the game after two rounds of the next set when bought in the first round', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            state.phaseId = '7'
            for (const definitionId of ['2', '2+', '3', '4', '5', '6', '7'])
                removeFromDepot(state, definitionId)
            const company = state.cash.find(
                (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'BA'
            )
            assertExists(company, 'BA holds cash')
            company.amount = 1100
        })
        passUntil(play, (state) => state.machineState === 'BuyingTrains')
        const eight = EighteenSeventeenTrainDepot.nextTrain(play.state.trainInventory, '8')
        play.act('BuyTrain', {
            companyId: 'BA',
            trainId: eight?.id,
            definitionId: '8',
            expectedPrice: 1100
        })
        expect(play.state.phaseId).toBe('8')
        expect(play.state.gameEnding).toEqual({
            reason: 'First 8-train',
            finalOperatingSet: 2,
            finalOperatingRounds: 2
        })
        passUntil(play, roundOf(2, 2))
        passUntil(play, (state) => state.machineState === 'GameOver')
    })

    it('ends the game after two rounds of the next set when exported in the first round', () => {
        const play = eightAfterRound(1)
        expect(play.state.gameEnding).toEqual({
            reason: 'First 8-train',
            finalOperatingSet: 2,
            finalOperatingRounds: 2
        })
        passUntil(play, roundOf(2, 2))
        expect(play.state.operatingSet?.roundCount).toBe(2)
        passUntil(play, (state) => state.machineState === 'GameOver')
    })

    it('ends the game after three rounds of the next set when exported in the second round', () => {
        const play = eightAfterRound(2)
        expect(play.state.gameEnding).toBeUndefined()
        passUntil(play, (state) => state.machineState === 'StockRound')
        expect(play.state.gameEnding).toEqual({
            reason: 'First 8-train',
            finalOperatingSet: 2,
            finalOperatingRounds: 3
        })
        passUntil(play, roundOf(2, 3))
        passUntil(play, (state) => state.machineState === 'GameOver')
    })
})
