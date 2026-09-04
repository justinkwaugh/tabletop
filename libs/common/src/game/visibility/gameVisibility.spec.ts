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
            ],
            forwardPatch: [
                {
                    op: 'replace',
                    path: '/secretValue',
                    value: 'canonical-middle-secret'
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

        const result = {
            processedActions: [action, systemAction],
            updatedState: after,
            indexOffset: 2,
            actionCascade: {
                before,
                transitions: [
                    { action, after: middle },
                    { action: systemAction, after }
                ]
            }
        }
        const visibleResult = Visibility.projectActionResult({
            result,
            visibility,
            perspective
        })
        const userAction = visibleResult.processedActions[0]
        const visibleSystemAction = visibleResult.processedActions[1]
        if (userAction === undefined || visibleSystemAction === undefined) {
            throw Error('Expected two projected Actions')
        }
        const visibleBefore = visibility.state.project(before, perspective)
        const visibleMiddle = visibility.state.project(middle, perspective)
        const visibleAfter = visibility.state.project(after, perspective)

        expect(userAction).toEqual({
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType,
            index: 0,
            publicValue: 'middle',
            forwardPatch: [{ op: 'replace', path: '/publicValue', value: 'middle' }],
            undoPatch: [{ op: 'replace', path: '/publicValue', value: 'before' }]
        })
        expect(visibleSystemAction).toEqual({
            id: 'action-2',
            gameId: 'game-1',
            source: ActionSource.System,
            type: ActionType,
            index: 1,
            publicValue: 'after',
            forwardPatch: [{ op: 'replace', path: '/publicValue', value: 'after' }],
            undoPatch: [{ op: 'replace', path: '/publicValue', value: 'middle' }]
        })

        if (
            userAction.forwardPatch === undefined ||
            userAction.undoPatch === undefined ||
            visibleSystemAction.forwardPatch === undefined ||
            visibleSystemAction.undoPatch === undefined
        ) {
            throw Error('Expected projected Actions to carry forward and undo patches')
        }

        const advancedToMiddle = jsonpatch.applyPatch(
            structuredClone(visibleBefore),
            userAction.forwardPatch
        ).newDocument
        const advancedToAfter = jsonpatch.applyPatch(
            structuredClone(advancedToMiddle),
            visibleSystemAction.forwardPatch
        ).newDocument
        const restoredToMiddle = jsonpatch.applyPatch(
            structuredClone(visibleAfter),
            visibleSystemAction.undoPatch
        ).newDocument
        const restoredToBefore = jsonpatch.applyPatch(
            structuredClone(restoredToMiddle),
            userAction.undoPatch
        ).newDocument

        expect(advancedToMiddle).toEqual(visibleMiddle)
        expect(advancedToAfter).toEqual(visibleAfter)
        expect(restoredToMiddle).toEqual(visibleMiddle)
        expect(restoredToBefore).toEqual(visibleBefore)
        expect(visibleResult.updatedState).toEqual(visibleAfter)
        expect(visibleResult.indexOffset).toBe(2)
        expect(visibleResult).not.toHaveProperty('actionCascade')
        expect(JSON.stringify(visibleResult)).not.toContain('canonical-user-action-secret')
        expect(JSON.stringify(visibleResult)).not.toContain('canonical-system-action-secret')
        expect(JSON.stringify(visibleResult)).not.toContain('canonical-before-secret')
        expect(JSON.stringify(visibleResult)).not.toContain('canonical-middle-secret')
        expect(JSON.stringify(visibleResult)).not.toContain('canonical-after-secret')
        expect(action.undoPatch).toEqual([
            {
                op: 'replace',
                path: '/secretValue',
                value: 'canonical-before-secret'
            }
        ])
        expect(action.forwardPatch).toEqual([
            {
                op: 'replace',
                path: '/secretValue',
                value: 'canonical-middle-secret'
            }
        ])
        expect(result.actionCascade.before).toBe(before)
        expect(result.processedActions).toEqual([action, systemAction])
    })

    it('reprojects complete Action History from canonical current state and undo patches', () => {
        const before = createState('before', 'canonical-before-secret')
        const middle = createState('middle', 'canonical-middle-secret')
        const after = createState('after', 'canonical-after-secret')
        before.actionCount = 0
        middle.actionCount = 1
        after.actionCount = 2
        const action: Type.Static<typeof ChangeValue> = {
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType,
            index: 0,
            publicValue: 'middle',
            secretValue: 'canonical-user-action-secret',
            undoPatch: jsonpatch.compare(middle, before)
        }
        const systemAction: Type.Static<typeof ChangeValue> = {
            id: 'action-2',
            gameId: 'game-1',
            source: ActionSource.System,
            type: ActionType,
            index: 1,
            publicValue: 'after',
            secretValue: 'canonical-system-action-secret',
            undoPatch: jsonpatch.compare(after, middle)
        }
        const actions = [systemAction, action]
        const canonicalInput = structuredClone({ currentState: after, actions })
        const visibility = {
            state: Visibility.createProjector(CanonicalState),
            actions: Visibility.createActionProjector({ [ActionType]: ChangeValue })
        }
        const perspective: Visibility.Perspective = { kind: 'spectator' }

        const projected = Visibility.projectActionHistory({
            currentState: after,
            actions,
            visibility,
            perspective
        })
        const expectedActions = Visibility.projectActionCascade(
            {
                before,
                transitions: [
                    { action, after: middle },
                    { action: systemAction, after }
                ]
            },
            { visibility, perspective }
        ).actions

        expect(projected).toEqual({
            startIndex: 0,
            currentState: visibility.state.project(after, perspective),
            actions: expectedActions
        })
        expect(JSON.stringify(projected)).not.toContain('canonical-before-secret')
        expect(JSON.stringify(projected)).not.toContain('canonical-middle-secret')
        expect(JSON.stringify(projected)).not.toContain('canonical-after-secret')
        expect(JSON.stringify(projected)).not.toContain('canonical-user-action-secret')
        expect(JSON.stringify(projected)).not.toContain('canonical-system-action-secret')
        expect({ currentState: after, actions }).toEqual(canonicalInput)
    })

    it('projects an empty Action History without requiring an undo patch', () => {
        const currentState = createState('current', 'canonical-current-secret')
        currentState.actionCount = 0
        const visibility = {
            state: Visibility.createProjector(CanonicalState),
            actions: Visibility.createActionProjector({ [ActionType]: ChangeValue })
        }
        const perspective: Visibility.Perspective = { kind: 'spectator' }

        expect(
            Visibility.projectActionHistory({
                currentState,
                actions: [],
                visibility,
                perspective
            })
        ).toEqual({
            startIndex: 0,
            currentState: visibility.state.project(currentState, perspective),
            actions: []
        })
    })

    it('reprojects a contiguous Action History suffix for undo replacement', () => {
        const before = createState('before', 'canonical-before-secret')
        const after = createState('after', 'canonical-after-secret')
        before.actionCount = 1
        after.actionCount = 2
        const action: Type.Static<typeof ChangeValue> = {
            id: 'replacement-action',
            gameId: 'game-1',
            source: ActionSource.System,
            type: ActionType,
            index: 1,
            publicValue: 'after',
            secretValue: 'canonical-action-secret',
            undoPatch: jsonpatch.compare(after, before)
        }
        const visibility = {
            state: Visibility.createProjector(CanonicalState),
            actions: Visibility.createActionProjector({ [ActionType]: ChangeValue })
        }
        const perspective: Visibility.Perspective = { kind: 'spectator' }

        const projected = Visibility.projectActionHistory({
            startIndex: 1,
            currentState: after,
            actions: [action],
            visibility,
            perspective
        })
        const expectedActions = Visibility.projectActionCascade(
            {
                before,
                transitions: [{ action, after }]
            },
            { visibility, perspective }
        ).actions

        expect(projected).toEqual({
            startIndex: 1,
            currentState: visibility.state.project(after, perspective),
            actions: expectedActions
        })
        expect(JSON.stringify(projected)).not.toContain('canonical-before-secret')
        expect(JSON.stringify(projected)).not.toContain('canonical-after-secret')
        expect(JSON.stringify(projected)).not.toContain('canonical-action-secret')
    })

    it('projects an empty replacement suffix with an explicit start index', () => {
        const currentState = createState('current', 'canonical-current-secret')
        currentState.actionCount = 2
        const visibility = {
            state: Visibility.createProjector(CanonicalState),
            actions: Visibility.createActionProjector({ [ActionType]: ChangeValue })
        }
        const perspective: Visibility.Perspective = { kind: 'spectator' }

        expect(
            Visibility.projectActionHistory({
                startIndex: 2,
                currentState,
                actions: [],
                visibility,
                perspective
            })
        ).toEqual({
            startIndex: 2,
            currentState: visibility.state.project(currentState, perspective),
            actions: []
        })
    })

    it('fails closed when canonical history contains an Action without an undo patch', () => {
        const currentState = createState('current', 'canonical-current-secret')
        const action: Type.Static<typeof ChangeValue> = {
            id: 'action-without-undo',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType,
            index: 0,
            publicValue: 'current',
            secretValue: 'canonical-action-secret'
        }
        const visibility = {
            state: Visibility.createProjector(CanonicalState),
            actions: Visibility.createActionProjector({ [ActionType]: ChangeValue })
        }

        expect(() =>
            Visibility.projectActionHistory({
                currentState,
                actions: [action],
                visibility,
                perspective: { kind: 'spectator' }
            })
        ).toThrow('Canonical Action action-without-undo has no undo patch')
    })

    it('fails closed when canonical current state and Action History are incomplete', () => {
        const currentState = createState('current', 'canonical-current-secret')
        currentState.actionCount = 2
        const action: Type.Static<typeof ChangeValue> = {
            id: 'only-action',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType,
            index: 0,
            publicValue: 'current',
            secretValue: 'canonical-action-secret',
            undoPatch: []
        }
        const visibility = {
            state: Visibility.createProjector(CanonicalState),
            actions: Visibility.createActionProjector({ [ActionType]: ChangeValue })
        }

        expect(() =>
            Visibility.projectActionHistory({
                currentState,
                actions: [action],
                visibility,
                perspective: { kind: 'spectator' }
            })
        ).toThrow(
            'Canonical Action History segment starts at 0 with 1 Actions but current state has Action count 2'
        )
    })

    it('preserves the canonical result when visibility is not registered', () => {
        const before = createState('before', 'canonical-before-secret')
        const after = createState('after', 'canonical-after-secret')
        const action: Type.Static<typeof ChangeValue> = {
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType,
            publicValue: 'after',
            secretValue: 'canonical-action-secret'
        }
        const result = {
            processedActions: [action],
            updatedState: after,
            indexOffset: 0,
            actionCascade: {
                before,
                transitions: [{ action, after }]
            }
        }

        const legacyResult = Visibility.projectActionResult({
            result,
            perspective: { kind: 'spectator' }
        })

        expect(legacyResult).toEqual({
            processedActions: [action],
            updatedState: after,
            indexOffset: 0
        })
        expect(legacyResult.processedActions).toBe(result.processedActions)
        expect(legacyResult.updatedState).toBe(result.updatedState)
        expect(legacyResult).not.toHaveProperty('actionCascade')
        expect(result.actionCascade).toEqual({
            before,
            transitions: [{ action, after }]
        })
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

    it('protects a complete Action while preserving its canonical schema for its actor', () => {
        const projector = Visibility.createActionProjector({
            [ActionType]: Visibility.protectAction(ChangeValue, {
                policy: Visibility.Policy.Actor
            })
        })
        const action: Type.Static<typeof ChangeValue> = {
            id: 'action-4',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType,
            playerId: 'player-1',
            index: 3,
            simultaneousGroupId: 'group-1',
            revealsInfo: true,
            skipOptimisticExecution: true,
            publicValue: 'semantic-payload',
            secretValue: 'host-only-payload'
        }

        expect(projector.project(action, { kind: 'player', playerId: 'player-1' })).toEqual({
            id: 'action-4',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType,
            playerId: 'player-1',
            index: 3,
            simultaneousGroupId: 'group-1',
            revealsInfo: true,
            skipOptimisticExecution: true,
            publicValue: 'semantic-payload'
        })
        expect(projector.project(action, { kind: 'player', playerId: 'player-2' })).toEqual({
            id: 'action-4',
            gameId: 'game-1',
            source: ActionSource.User,
            type: Visibility.RedactedActionType,
            playerId: 'player-1',
            index: 3,
            simultaneousGroupId: 'group-1',
            revealsInfo: true
        })
    })

    it('declares canonical Action patches as host-only engine data', () => {
        expect(GameAction.properties.undoPatch[Visibility.MetadataKey]).toEqual({
            policy: Visibility.Policy.HostOnly,
            redaction: { kind: 'omit' }
        })
        expect(GameAction.properties.forwardPatch[Visibility.MetadataKey]).toEqual({
            policy: Visibility.Policy.HostOnly,
            redaction: { kind: 'omit' }
        })
    })
})
