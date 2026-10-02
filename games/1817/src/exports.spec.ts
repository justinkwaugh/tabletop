import { describe, expect, it } from 'vitest'
import { unownedTrain, type EighteenXXState, type Train } from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import { EighteenSeventeenScenarios } from './scenarios/index.js'

function operatingCompanyId(state: EighteenXXState): string | undefined {
    return (
        state.trackStep?.companyId ??
        state.trainPurchaseStep?.companyId ??
        state.phaseChange?.discardCompanyIds[0]
    )
}

// Lays no track, runs nothing and buys nothing, so the round ends only through exports.
function idle(play: ExamplePlay, until: (state: EighteenXXState) => boolean) {
    for (let step = 0; step < 100 && !until(play.state); step++) {
        const actions = play.valid(play.state.activePlayerIds[0])
        const companyId = operatingCompanyId(play.state)
        if (actions.includes('FinishTrack')) play.act('FinishTrack', { companyId })
        else if (actions.includes('FinishOperatingTurn'))
            play.act('FinishOperatingTurn', { companyId })
        else if (actions.includes('DiscardTrain'))
            play.act('DiscardTrain', {
                companyId,
                trainId: play.state.trainInventory.trains.find(
                    (train) =>
                        train.status === 'owned' &&
                        train.owner.kind === 'company' &&
                        train.owner.companyId === companyId
                )!.id
            })
        else if (actions.includes('FinishStockTurn')) play.act('FinishStockTurn')
        else throw new Error(`No idle action in ${play.state.machineState}`)
    }
    expect(until(play.state)).toBe(true)
}

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

/** Removes every depot train before the given one, as though bought and scrapped earlier. */
function exportedUpTo(state: EighteenXXState, definitionIds: readonly string[]) {
    state.trainInventory.trains = state.trainInventory.trains.map((train) =>
        train.status === 'depot' && definitionIds.includes(train.definitionId)
            ? unownedTrain(train, 'removed')
            : train
    )
}

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
        idle(play, roundOf(1, 2))
        expect(depot(play.state, '2')).toEqual([])
        expect(removed(play.state)).toEqual(Array(depotTwos).fill('2'))
        expect(play.state.phaseId).toBe('2')

        idle(play, (state) => state.machineState === 'StockRound')
        expect(removed(play.state).slice(depotTwos)).toEqual(['2+'])
        expect(play.state.phaseId).toBe('2+')

        idle(play, roundOf(2, 2))
        expect(removed(play.state).slice(depotTwos)).toEqual(['2+', '2+'])
    })

    it('changes phase by export, rusting trains and enforcing the new limit', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            state.phaseId = '3'
            state.trainInventory.trains = state.trainInventory.trains.map((train) =>
                train.status === 'owned' &&
                train.owner.kind === 'company' &&
                train.owner.companyId === 'BA'
                    ? unownedTrain(train, 'removed')
                    : train
            )
            for (let count = 0; count < 4; count++) give(state, 'BA', '3')
            exportedUpTo(state, ['2', '2+', '3'])
        })
        idle(play, (state) => state.machineState === 'DiscardingTrains')
        expect(play.state.phaseId).toBe('4')
        expect(removed(play.state).filter((id) => id === '4')).toHaveLength(1)
        expect(play.state.phaseChange?.discardCompanyIds).toEqual(['BA'])
        expect(
            play.state.trainInventory.trains.filter(
                (train) => train.definitionId === '2' && train.status === 'owned'
            )
        ).toEqual([])
        idle(play, (state) => state.machineState === 'StockRound')
    })
})

describe('the first 8-train', () => {
    function eightAfterRound(roundNumber: number) {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            state.phaseId = '7'
            exportedUpTo(state, ['2', '2+', '3', '4', '5', '6', '7'])
            if (roundNumber === 2) {
                const seven = state.trainInventory.trains.find(
                    (train) => train.definitionId === '7'
                )!
                Object.assign(seven, { status: 'depot' })
            }
        })
        idle(play, roundOf(1, 2))
        return play
    }

    it('ends the game after two rounds of the next set when exported in the first round', () => {
        const play = eightAfterRound(1)
        expect(play.state.gameEnding).toEqual({
            reason: 'First 8-train',
            finalOperatingSet: 2,
            finalOperatingRounds: 2
        })
        idle(play, roundOf(2, 2))
        expect(play.state.operatingSet?.roundCount).toBe(2)
        idle(play, (state) => state.machineState === 'GameOver')
    })

    it('ends the game after three rounds of the next set when exported in the second round', () => {
        const play = eightAfterRound(2)
        expect(play.state.gameEnding).toBeUndefined()
        idle(play, (state) => state.machineState === 'StockRound')
        expect(play.state.gameEnding).toEqual({
            reason: 'First 8-train',
            finalOperatingSet: 2,
            finalOperatingRounds: 3
        })
        idle(play, roundOf(2, 3))
        idle(play, (state) => state.machineState === 'GameOver')
    })
})
