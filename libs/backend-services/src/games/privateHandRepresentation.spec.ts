import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameAddProjectedActionsNotification,
    Role,
    UserStatus,
    Visibility,
    assertExists,
    type User
} from '@tabletop/common'
import * as Value from 'typebox/value'
import {
    PrivateHandHost,
    runtime,
    p1,
    p2,
    spectator,
    CanonicalValidator,
    SharedValidator
} from '@tabletop/common/test-fixtures/private-hand'
import {
    createGameRepresentation,
    createActionResultsRepresentation,
    createUndoResultsRepresentation
} from './gameRepresentation.js'
import { publishActionResults } from './gameNotifications.js'
import type { NotificationService } from '../notifications/notificationService.js'

function userFor(perspective: Visibility.Perspective): User {
    return {
        id: perspective.kind === 'player' ? perspective.playerId : 'observer',
        roles: [Role.User],
        status: UserStatus.Active,
        externalIds: []
    }
}

describe('private-hand hosted representations', () => {
    it.each([p1, p2, spectator])(
        'loads, delivers and reverses private hands for $kind $playerId',
        (perspective) => {
            const host = new PrivateHandHost()
            const user = userFor(perspective)
            const before = host.state
            const loaded = createGameRepresentation({
                game: { ...host.game, state: before },
                actions: [],
                runtime,
                visibility: runtime.visibility,
                user
            })
            expect(loaded.game.state).toEqual(host.history(perspective).currentState)
            expect(CanonicalValidator.Check(loaded.game.state)).toBe(false)
            expect(SharedValidator.Check(loaded.game.state)).toBe(true)
            assertExists(loaded.game.state, 'Expected projected load')
            const played = {
                id: 'play',
                gameId: host.game.id,
                source: ActionSource.User,
                playerId: 'p1',
                type: 'play',
                cardId: 'r1'
            }
            const result = host.apply(played)
            const response = createActionResultsRepresentation({
                game: { ...host.game, state: host.state },
                result,
                storedActions: result.processedActions,
                missingActions: [],
                priorState: before,
                runtime,
                visibility: runtime.visibility,
                user
            })
            expect(response.game).not.toHaveProperty('state')
            let state = host.history(perspective).currentState
            for (const action of response.actions.toReversed())
                state = host.engine.undoProcessedAction({ state, action })
            expect(state).toEqual(loaded.game.state)
            for (const action of response.actions)
                state = host.engine.applyProcessedAction({ state, action, game: host.game })
            expect(state).toEqual(host.history(perspective).currentState)
            host.undo(played.id)
            const undo = createUndoResultsRepresentation({
                game: { ...host.game, state: host.state },
                actionReplay: { startIndex: 0, actions: [] },
                undoneActions: result.processedActions,
                redoneActions: [],
                runtime,
                visibility: runtime.visibility,
                user
            })
            expect(undo.game).not.toHaveProperty('state')
            expect(undo.actionReplay).toEqual({ startIndex: 0, actions: [] })
            expect(undo.checksum).toBe(before.actionChecksum)
        }
    )

    it('publishes projected draw results to each owner and the spectator topic', async () => {
        const host = new PrivateHandHost()
        const before = host.state
        const result = host.apply({
            id: 'draw',
            gameId: host.game.id,
            source: ActionSource.User,
            type: 'draw',
            playerId: 'p1',
            revealsInfo: true
        })
        const publications: Parameters<NotificationService['sendNotification']>[0][] = []
        await publishActionResults({
            game: { ...host.game, state: host.state },
            result,
            storedActions: result.processedActions,
            priorState: before,
            runtime,
            visibility: runtime.visibility,
            notificationService: {
                sendNotification: async (publication) => {
                    publications.push(publication)
                }
            }
        })
        expect(publications).toHaveLength(3)
        for (const publication of publications) {
            const notification = publication.notification
            if (!Value.Check(GameAddProjectedActionsNotification, notification))
                throw Error('Expected projected notification')
            expect(notification.data.game).not.toHaveProperty('state')
            const perspective = notification.data.perspective
            assertExists(runtime.visibility, 'Expected visibility')
            let state = runtime.visibility.state.project(before, perspective)
            for (const action of notification.data.actions)
                state = host.engine.applyProcessedAction({ game: host.game, state, action })
            expect(state).toEqual(host.history(perspective).currentState)
            expect(state.players[0].hand?.cards.length).toBe(
                perspective.kind === 'player' && perspective.playerId === 'p1' ? 3 : undefined
            )
            expect(state.secretBonus).toBeUndefined()
        }
    })
})
