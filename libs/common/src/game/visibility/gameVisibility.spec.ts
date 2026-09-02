import jsonpatch from 'fast-json-patch'
import * as Type from 'typebox'
import { describe, expect, it } from 'vitest'
import { ActionSource, GameAction } from '../engine/gameAction.js'
import { GameState } from '../model/gameState.js'
import * as Visibility from './index.js'

const ActionType = 'changeValue'
const ActionPolicy = 'example.action-audience'

const CanonicalState = Type.Evaluate(
    Type.Intersect([
        GameState,
        Type.Object({
            publicValue: Type.String(),
            secretValue: Visibility.protect(Type.String(), {
                policy: Visibility.Policy.HostOnly
            })
        })
    ])
)

const ChangeValue = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType),
            publicValue: Type.String(),
            secretValue: Visibility.protect(Type.String(), {
                policy: Visibility.Policy.HostOnly
            })
        })
    ])
)

const ShareValue = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal('shareValue'),
            audienceId: Type.String(),
            value: Visibility.protect(Type.String(), { policy: ActionPolicy })
        })
    ])
)

function createState(publicValue: string, secretValue: string): Type.Static<typeof CanonicalState> {
    return {
        id: 'state-1',
        gameId: 'game-1',
        players: [],
        activePlayerIds: [],
        actionCount: 1,
        actionChecksum: 1,
        prng: { seed: 1, invocations: 0 },
        machineState: 'test',
        turnManager: { series: [], turnOrder: [], turnCounts: {} },
        winningPlayerIds: [],
        publicValue,
        secretValue
    }
}

describe('game visibility', () => {
    it('projects a complete Action cascade and derives every patch only from projected states', () => {
        const before = createState('before', 'canonical-before-secret')
        const middle = createState('middle', 'canonical-middle-secret')
        const after = createState('after', 'canonical-after-secret')
        const action: Type.Static<typeof ChangeValue> = {
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType,
            index: 0,
            publicValue: 'middle',
            secretValue: 'canonical-user-action-secret',
            undoPatch: [
                {
                    op: 'replace',
                    path: '/secretValue',
                    value: 'canonical-before-secret'
                }
            ]
        }
        const systemAction: Type.Static<typeof ChangeValue> = {
            id: 'action-2',
            gameId: 'game-1',
            source: ActionSource.System,
            type: ActionType,
            index: 1,
            publicValue: 'after',
            secretValue: 'canonical-system-action-secret',
            undoPatch: [
                {
                    op: 'replace',
                    path: '/secretValue',
                    value: 'canonical-middle-secret'
                }
            ]
        }
        const visibility = {
            state: Visibility.createProjector(CanonicalState),
            actions: Visibility.createActionProjector({ [ActionType]: ChangeValue })
        }
        const perspective: Visibility.Perspective = { kind: 'spectator' }

        const visibleActionCascade = Visibility.projectActionCascade(
            {
                before,
                transitions: [
                    { action, after: middle },
                    { action: systemAction, after }
                ]
            },
            { visibility, perspective }
        )
        const userTransition = visibleActionCascade.transitions[0]
        const systemTransition = visibleActionCascade.transitions[1]
        if (userTransition === undefined || systemTransition === undefined) {
            throw Error('Expected two projected transitions')
        }
        const visibleBefore = visibility.state.project(before, perspective)
        const visibleMiddle = visibility.state.project(middle, perspective)
        const visibleAfter = visibility.state.project(after, perspective)

        expect(userTransition.action).toEqual({
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType,
            index: 0,
            publicValue: 'middle'
        })
        expect(systemTransition.action).toEqual({
            id: 'action-2',
            gameId: 'game-1',
            source: ActionSource.System,
            type: ActionType,
            index: 1,
            publicValue: 'after'
        })
        expect(userTransition.forwardPatch).toEqual([
            { op: 'replace', path: '/publicValue', value: 'middle' }
        ])
        expect(userTransition.undoPatch).toEqual([
            { op: 'replace', path: '/publicValue', value: 'before' }
        ])
        expect(systemTransition.forwardPatch).toEqual([
            { op: 'replace', path: '/publicValue', value: 'after' }
        ])
        expect(systemTransition.undoPatch).toEqual([
            { op: 'replace', path: '/publicValue', value: 'middle' }
        ])

        const advancedToMiddle = jsonpatch.applyPatch(
            structuredClone(visibleBefore),
            userTransition.forwardPatch
        ).newDocument
        const advancedToAfter = jsonpatch.applyPatch(
            structuredClone(advancedToMiddle),
            systemTransition.forwardPatch
        ).newDocument
        const restoredToMiddle = jsonpatch.applyPatch(
            structuredClone(visibleAfter),
            systemTransition.undoPatch
        ).newDocument
        const restoredToBefore = jsonpatch.applyPatch(
            structuredClone(restoredToMiddle),
            userTransition.undoPatch
        ).newDocument

        expect(advancedToMiddle).toEqual(visibleMiddle)
        expect(advancedToAfter).toEqual(visibleAfter)
        expect(restoredToMiddle).toEqual(visibleMiddle)
        expect(restoredToBefore).toEqual(visibleBefore)
        expect(JSON.stringify(visibleActionCascade)).not.toContain('canonical-user-action-secret')
        expect(JSON.stringify(visibleActionCascade)).not.toContain('canonical-system-action-secret')
        expect(JSON.stringify(visibleActionCascade)).not.toContain('canonical-before-secret')
        expect(JSON.stringify(visibleActionCascade)).not.toContain('canonical-middle-secret')
        expect(JSON.stringify(visibleActionCascade)).not.toContain('canonical-after-secret')
        expect(action.undoPatch).toEqual([
            {
                op: 'replace',
                path: '/secretValue',
                value: 'canonical-before-secret'
            }
        ])
    })

    it('fails closed when an Action schema has not been registered', () => {
        const projector = Visibility.createActionProjector({ [ActionType]: ChangeValue })

        expect(() =>
            projector.project(
                {
                    id: 'action-2',
                    gameId: 'game-1',
                    source: ActionSource.System,
                    type: 'unregisteredAction'
                },
                { kind: 'spectator' }
            )
        ).toThrow('No visibility schema registered for Action type "unregisteredAction"')
    })

    it('passes typed game-owned policies to every registered Action projector', () => {
        const projector = Visibility.createActionProjector(
            { shareValue: ShareValue },
            {
                policies: {
                    [ActionPolicy]: ({ perspective, root }) =>
                        perspective.kind === 'player' && perspective.playerId === root.audienceId
                }
            }
        )
        const action: Type.Static<typeof ShareValue> = {
            id: 'action-3',
            gameId: 'game-1',
            source: ActionSource.System,
            type: 'shareValue',
            audienceId: 'player-1',
            value: 'private-value'
        }

        expect(projector.project(action, { kind: 'player', playerId: 'player-1' })).toEqual(action)
        expect(projector.project(action, { kind: 'player', playerId: 'player-2' })).toEqual({
            id: 'action-3',
            gameId: 'game-1',
            source: ActionSource.System,
            type: 'shareValue',
            audienceId: 'player-1'
        })
    })

    it('declares canonical undo patches as host-only engine data', () => {
        expect(GameAction.properties.undoPatch[Visibility.MetadataKey]).toEqual({
            policy: Visibility.Policy.HostOnly,
            redaction: { kind: 'omit' }
        })
    })
})
