import { expect, it } from 'vitest'
import { ownViewActions } from '@tabletop/18xx/testing'
import { finishedGame } from './finishedGame.js'

it('offers every 1846 player the same actions in their own view as in the full game', async () => {
    const { game, initialState, actions, engine } = await finishedGame(
        'local-user',
        'Finished game',
        '1846'
    )
    const mismatches: string[] = []
    let state = initialState
    for (const action of actions) {
        state = engine.applyProcessedAction({ game, state, action })
        for (const { playerId } of state.players) {
            let ownViewOutcome: string
            let full: string[] = []
            try {
                const result = ownViewActions(engine, game, state, playerId)
                ownViewOutcome = JSON.stringify(result.own)
                full = result.full
            } catch (error) {
                ownViewOutcome = String(error)
            }
            if (ownViewOutcome !== JSON.stringify(full))
                mismatches.push(
                    `${action.id} ${state.machineState} ${playerId}: ${ownViewOutcome} vs ${JSON.stringify(full)}`
                )
        }
    }
    expect(mismatches).toEqual([])
}, 120_000)
