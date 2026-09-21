import { createAction, type GameAction } from '@tabletop/common'
import type { SessionContext } from './sessionContext.js'

export function testContext<State, Rules>(
    state: State,
    rules: Rules,
    validActionTypes: string[],
    availability: { draftsVisible?: boolean; interactive?: boolean; actingPlayerIds?: string[] } = {}
) {
    const applied: GameAction[] = []
    const context: SessionContext<State, Rules> = {
        state,
        rules,
        validActionTypes,
        draftsVisible: availability.draftsVisible ?? true,
        interactive: availability.interactive ?? true,
        actingPlayerIds: availability.actingPlayerIds ?? ['alex'],
        canActFor: (playerId) => (availability.actingPlayerIds ?? ['alex']).includes(playerId),
        createPlayerAction: (schema, data) =>
            Object.assign(createAction(schema, data), {
                id: 'action',
                gameId: 'game',
                playerId: 'alex'
            }),
        applyAction: async (action) => {
            applied.push(action)
        }
    }
    return { context, applied }
}
