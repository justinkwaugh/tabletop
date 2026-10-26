import { expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { finishedGame } from './finishedGame.js'

it('offers every 1846 player the same actions in their own view as in the full game', async () => {
    const { game, initialState, actions, engine } = await finishedGame(
        'local-user',
        'Finished game',
        '1846'
    )
    const visibility = engine.runtime.visibility
    assertExists(visibility)
    const mismatches: string[] = []
    let state = initialState
    for (const action of actions) {
        state = engine.applyProcessedAction({ game, state, action })
        for (const { playerId } of state.players) {
            const perspective = { kind: 'player', playerId } as const
            const view = visibility.state.project(state, perspective)
            const full = engine.getValidActionTypesForPlayer(game, state, playerId)
            let own: string[] | string
            try {
                own = engine.getValidActionTypesForPlayer(game, view, playerId, { perspective })
            } catch (error) {
                own = String(error)
            }
            if (JSON.stringify(own) !== JSON.stringify(full))
                mismatches.push(
                    `${action.id} ${state.machineState} ${playerId}: ${JSON.stringify(own)} vs ${JSON.stringify(full)}`
                )
        }
    }
    expect(mismatches).toEqual([])
}, 120_000)
