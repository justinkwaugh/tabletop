import { expect, it } from 'vitest'
import { assert, ActionSource, GameAction } from '@tabletop/common'
import * as Value from 'typebox/value'
import { CompleteGameRun, FullGameTitles } from './completeGame.js'

function verifyHistory(run: CompleteGameRun) {
    let replay = run.initial
    for (const serialized of JSON.parse(JSON.stringify(run.history))) {
        const action = Value.Convert(GameAction, serialized)
        assert(Value.Check(GameAction, action), 'Invalid persisted action')
        replay = run.engine.applyProcessedAction({ game: run.game, state: replay, action })
    }
    expect(replay).toEqual(run.state)
    for (const action of [...run.history].reverse())
        replay = run.engine.undoProcessedAction({ state: replay, action })
    expect(replay).toEqual(run.initial)
    const regeneratedIds: string[] = []
    for (const action of run.history.filter((action) => action.source === ActionSource.User)) {
        const regenerated = run.engine.executeCanonicalAction({
            game: run.game,
            state: replay,
            action
        })
        replay = regenerated.updatedState
        regeneratedIds.push(...regenerated.processedActions.map((action) => action.id))
    }
    expect(replay).toEqual(run.state)
    expect(regeneratedIds).toEqual(run.history.map((action) => action.id))
}

function verifyEnding(run: CompleteGameRun) {
    expect(run.state.machineState).toBe('GameOver')
    expect(run.state.finalWealth).toHaveLength(run.state.players.length)
    expect(run.state.winningPlayerIds.length).toBeGreaterThan(0)
    expect(run.state.activePlayerIds).toEqual([])
    for (const player of run.state.players)
        expect(
            run.engine.getValidActionTypesForPlayer(run.game, run.state, player.playerId)
        ).toEqual([])
    expect(() => run.act('FinishStockTurn', { playerId: run.state.players[0].playerId })).toThrow()
    verifyHistory(run)
}

it.each(FullGameTitles)(
    'plays a normal game from opening through final wealth: $definition.info.id',
    (title) => {
        const run = new CompleteGameRun(title, 3)
        for (let step = 0; step < 2500 && !run.state.result; step++) run.step()
        expect(run.state.gameEnding?.reason).toBe(
            title.definition.info.id === 'the-old-prince' ? 'First diesel' : 'Bank broken'
        )
        expect(run.history.some((action) => action.type === 'RunTrains')).toBe(true)
        verifyEnding(run)
    },
    240000
)

it.each(FullGameTitles)(
    'replays and undoes bankruptcy through final wealth: $definition.info.id',
    (title) => {
        const run = new CompleteGameRun(title, 3, 5, 'bankruptcy')
        run.step()
        expect(run.state.gameEnding?.reason).toBe('Bankruptcy')
        verifyEnding(run)
    }
)

for (const title of FullGameTitles) {
    const { minPlayers, maxPlayers } = title.definition.info.metadata
    for (let count = minPlayers; count <= maxPlayers; count++) {
        it(`completes the opening auction and restores history: ${title.definition.info.id}, ${count} players`, () => {
            const run = new CompleteGameRun(title, count)
            for (let step = 0; step < 400 && run.state.machineState !== 'StockRound'; step++)
                run.step()
            expect(run.state.machineState).toBe('StockRound')
            expect(run.state.players).toHaveLength(count)
            verifyHistory(run)
        })
    }
}
