import { createAction, type GameAction } from '@tabletop/common'
import type { ModuleSession } from './moduleSession.js'

export function testSession<State, Rules>(
    state: State,
    rules: Rules,
    validActionTypes: string[],
    availability: {
        publishing?: boolean
        selectionsVisible?: boolean
        interactive?: boolean
        ordinaryHotseatPlay?: boolean
        viewingAsNonActivePlayer?: boolean
        actingPlayerIds?: string[]
        recordedActions?: GameAction[]
    } = {}
) {
    const applied: GameAction[] = []
    const session: ModuleSession<State, Rules> = {
        state,
        rules,
        validActionTypes,
        publishing: availability.publishing ?? false,
        viewingHistory: false,
        selectionsVisible: availability.selectionsVisible ?? true,
        interactive: availability.interactive ?? true,
        ordinaryHotseatPlay: availability.ordinaryHotseatPlay ?? false,
        viewingAsNonActivePlayer: availability.viewingAsNonActivePlayer ?? false,
        playerId: 'alex',
        actingPlayerIds: availability.actingPlayerIds ?? ['alex'],
        canActFor: (playerId) => (availability.actingPlayerIds ?? ['alex']).includes(playerId),
        recordedActions: availability.recordedActions ?? [],
        settled: async () => {},
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
    return { session, applied }
}
