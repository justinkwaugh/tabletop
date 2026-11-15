import { assertExists, createAction, type GameAction } from '@tabletop/common'
import type { TrainDepot, TrainInventory } from '@tabletop/18xx'
import { TestCompanyId } from '@tabletop/18xx/testing'
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
        supersedes?: string
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
        withSupersededAction: (action) =>
            availability.supersedes
                ? { ...action, supersedesActionId: availability.supersedes }
                : action,
        settled: async () => {},
        createPlayerAction: (schema, data) =>
            Object.assign(createAction(schema, data), {
                id: 'action',
                gameId: 'game',
                playerId: 'alex'
            }),
        applyAction: async (action) => {
            applied.push(action)
        },
        applyPreparedAction: async (prepare) => {
            const action = await prepare()
            if (action) applied.push(action)
        }
    }
    return { session, applied }
}

/** Takes the depot's next ``definitionId`` train for the test company; returns its id. */
export function companyTrain(
    depot: TrainDepot,
    inventory: TrainInventory,
    definitionId: string
): string {
    const train = depot.nextTrain(inventory, definitionId)
    assertExists(train)
    depot.purchase(inventory, train.id, definitionId, { kind: 'company', companyId: TestCompanyId })
    return train.id
}
