import * as Type from 'typebox'
import {
    ActionSource,
    AuctionType,
    calculateActionChecksum,
    GameEngine,
    GameStatus,
    GameState,
    GameSyncStatus,
    HydratedSimultaneousAuction,
    PlayerStatus,
    Role,
    TieResolutionStrategy,
    type Game,
    type User,
    UserStatus,
    Visibility
} from '@tabletop/common'
import { SyntheticDefinition, SyntheticRuntime, type PlaceBid } from './tests/syntheticGame.js'
import { describe, expect, it } from 'vitest'
import {
    createActionResultsRepresentation,
    createGameRepresentation,
    createGameRepresentationEtag,
    createGameSyncRepresentation,
    createUndoResultsRepresentation
} from './gameRepresentation.js'

function createUser(id: string): User {
    return {
        id,
        status: UserStatus.Active,
        roles: [Role.User],
        externalIds: []
    }
}

function withoutGameState(game: Game): Game {
    const gameWithoutState = structuredClone(game)
    delete gameWithoutState.state
    return gameWithoutState
}

function createSyntheticHistory() {
    const game = SyntheticRuntime.initializer.initializeGame(
        {
            id: 'game-1',
            typeId: SyntheticDefinition.info.id,
            ownerId: 'user-1',
            players: [
                {
                    id: 'p1',
                    userId: 'user-1',
                    name: 'Player 1',
                    isHuman: true,
                    status: PlayerStatus.Joined
                },
                {
                    id: 'p2',
                    userId: 'user-2',
                    name: 'Player 2',
                    isHuman: true,
                    status: PlayerStatus.Joined
                },
                {
                    id: 'p3',
                    userId: 'user-3',
                    name: 'Player 3',
                    isHuman: true,
                    status: PlayerStatus.Joined
                }
            ],
            config: {},
            seed: 12345
        },
        SyntheticDefinition
    )
    game.status = GameStatus.Started
    game.protectedInformation = true

    const engine = new GameEngine(SyntheticRuntime)
    const hydratedState = SyntheticRuntime.initializer.initializeGameState(
        game,
        engine.generateUninitializedState(game)
    )
    hydratedState.currentAuction = new HydratedSimultaneousAuction({
        id: 'auction-1',
        type: AuctionType.Simultaneous,
        participants: [
            { playerId: 'p1', bid: 3, passed: false },
            { playerId: 'p2', bid: 5, passed: false },
            { playerId: 'p3', passed: false }
        ],
        auctioneerId: 'p1',
        tie: false,
        tieResolution: TieResolutionStrategy.FirstInOrder
    })

    const before = hydratedState.dehydrate()
    const firstToken = before.drawPile.items[0]
    if (firstToken === undefined) {
        throw Error('Expected synthetic game to initialize a non-empty draw pile')
    }
    Reflect.set(firstToken, 'test', 'canonical-hidden-token')

    const after = structuredClone(before)
    const auction = after.currentAuction
    if (auction === undefined) {
        throw Error('Expected a current auction')
    }
    auction.participants[2].bid = 7
    after.actionCount = 1

    const action: PlaceBid = {
        id: 'action-1',
        gameId: game.id,
        source: ActionSource.User,
        type: 'bid',
        playerId: 'p3',
        amount: 7,
        index: 0,
        undoPatch: []
    }
    after.actionChecksum = calculateActionChecksum(0, [action])
    action.undoPatch = [
        { op: 'replace', path: '/actionChecksum', value: before.actionChecksum },
        { op: 'replace', path: '/actionCount', value: before.actionCount },
        { op: 'remove', path: '/currentAuction/participants/2/bid' }
    ]

    return { game: { ...game, state: after }, before, after, action }
}

const syntheticHistory = createSyntheticHistory()

describe('unprotected Games under a visibility-aware publication', () => {
    it.each([1, 2, 3])('keeps version %i canonical across delivery paths', (systemVersion) => {
        const { game, before, after, action } = structuredClone(syntheticHistory)
        delete game.protectedInformation
        before.systemVersion = systemVersion
        after.systemVersion = systemVersion
        game.state = after
        const actions = [action]
        const options = {
            game,
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-1')
        }
        expect(createGameRepresentation({ ...options, actions })).toEqual({
            game,
            actions,
            perspective: undefined
        })
        expect(createGameRepresentationEtag({ ...options, canonicalEtag: 'revision' })).toBe(
            'revision'
        )
        expect(
            createGameSyncRepresentation({ ...options, actions, status: GameSyncStatus.InSync })
        ).toEqual({ status: GameSyncStatus.InSync, actions, checksum: after.actionChecksum })
        const result = createActionResultsRepresentation({
            ...options,
            result: {
                processedActions: actions,
                updatedState: after,
                indexOffset: 0,
                actionCascade: { before, transitions: [{ action, after }] }
            },
            storedActions: actions,
            missingActions: [],
            priorState: before
        })
        expect(result.actions).toBe(actions)
        expect(result.perspective).toBeUndefined()
        const undo = createUndoResultsRepresentation({
            ...options,
            actionReplay: { startIndex: 0, actions },
            undoneActions: actions,
            redoneActions: []
        })
        expect(undo.undoneActions).toBe(actions)
        expect(undo.perspective).toBeUndefined()
        expect(undo.canonicalReplay.userActions[0]).toHaveProperty('amount', 7)
    })

    it.each([false, true])(
        'fails closed when protection loses its projector, host view %s',
        (hostView) => {
            const { game, action } = syntheticHistory
            expect(() =>
                createGameRepresentation({
                    game,
                    actions: [action],
                    hostView,
                    user: createUser('user-1')
                })
            ).toThrow('registered visibility')
            expect(() =>
                createGameRepresentationEtag({
                    game,
                    hostView,
                    canonicalEtag: 'revision',
                    user: createUser('user-1')
                })
            ).toThrow('registered visibility')
        }
    )
})

describe('incompatible historical schemas', () => {
    it('loads the current projection and keeps unavailable sync records private', () => {
        const { game, after, action } = structuredClone(syntheticHistory)
        action.undoPatch?.push({ op: 'remove', path: '/board' })
        const options = {
            game,
            actions: [action],
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-1')
        }
        const loaded = createGameRepresentation(options)
        const expectedState = SyntheticRuntime.visibility.state.project(after, {
            kind: 'player',
            playerId: 'p1'
        })
        expect(loaded.game.state).toEqual(expectedState)
        expect(loaded.actions[0]).toMatchObject({
            id: action.id,
            index: 0,
            type: Visibility.RedactedActionType
        })
        expect(loaded.actions[0]).not.toHaveProperty('undoPatch')
        expect(loaded.actions[0]).not.toHaveProperty('amount')
        const missing = createActionResultsRepresentation({
            ...options,
            result: {
                processedActions: [],
                updatedState: after,
                indexOffset: 0,
                actionCascade: { before: after, transitions: [] }
            },
            priorState: after,
            storedActions: [],
            missingActions: [action]
        })
        const synced = createGameSyncRepresentation({
            ...options,
            status: GameSyncStatus.OutOfSync
        })
        expect(synced.actions).toEqual(loaded.actions)
        expect(synced.checksum).toBe(after.actionChecksum)
        expect(missing.missingActions).toEqual(loaded.actions)
        expect(JSON.stringify({ loaded, missing })).not.toContain('canonical-hidden-token')
    })
})

describe('createGameRepresentationEtag', () => {
    it('preserves the canonical ETag for a Game Title without visibility registration', () => {
        expect(
            createGameRepresentationEtag({
                canonicalEtag: 'canonical-revision',
                game: { ...syntheticHistory.game, protectedInformation: undefined },
                user: createUser('user-1')
            })
        ).toBe('canonical-revision')
    })

    it('derives stable and distinct ETags for projected perspectives', () => {
        const createEtag = (userId: string, canonicalEtag = 'canonical-revision') =>
            createGameRepresentationEtag({
                canonicalEtag,
                game: syntheticHistory.game,
                visibility: SyntheticRuntime.visibility,
                user: createUser(userId)
            })

        const playerOneEtag = createEtag('user-1')

        expect(playerOneEtag).toBeDefined()
        expect(createEtag('user-1')).toBe(playerOneEtag)
        expect(createEtag('user-3')).not.toBe(playerOneEtag)
        expect(createEtag('spectator-user')).not.toBe(playerOneEtag)
        expect(createEtag('another-spectator')).toBe(createEtag('spectator-user'))
        expect(createEtag('user-1', 'next-canonical-revision')).not.toBe(playerOneEtag)
        expect(playerOneEtag).not.toBe('canonical-revision')
    })

    it('uses the canonical ETag for Host View', () => {
        expect(
            createGameRepresentationEtag({
                canonicalEtag: 'canonical-revision',
                game: syntheticHistory.game,
                hostView: true,
                visibility: SyntheticRuntime.visibility,
                user: createUser('user-1')
            })
        ).toBe('canonical-revision')
    })

    it('uses the canonical ETag for a hotseat Game', () => {
        const game = structuredClone(syntheticHistory.game)
        game.hotseat = true

        expect(
            createGameRepresentationEtag({
                canonicalEtag: 'canonical-revision',
                game,
                visibility: SyntheticRuntime.visibility,
                user: createUser('user-1')
            })
        ).toBe('canonical-revision')
    })
})

describe('createGameRepresentation', () => {
    it('projects synthetic game state and complete Action History for the authenticated Player', () => {
        const { game, before, after, action } = syntheticHistory
        const representation = createGameRepresentation({
            game,
            actions: [action],
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-1')
        })
        const perspective = { kind: 'player', playerId: 'p1' } as const
        const expectedState = SyntheticRuntime.visibility.state.project(after, perspective)
        const expectedBefore = SyntheticRuntime.visibility.state.project(before, perspective)

        expect(representation.perspective).toEqual(perspective)
        expect(representation.game.state).toEqual(expectedState)
        expect(expectedState.drawPile.items).toEqual([])
        expect(expectedState.currentAuction?.participants).toEqual([
            { playerId: 'p1', bid: 3, passed: false },
            { playerId: 'p2', passed: false },
            { playerId: 'p3', passed: false }
        ])
        expect(representation.actions).toHaveLength(1)

        const visibleAction = representation.actions[0]
        if (visibleAction === undefined) {
            throw Error('Expected one visible Action')
        }
        expect(visibleAction).toMatchObject({
            id: action.id,
            gameId: action.gameId,
            source: action.source,
            type: action.type,
            playerId: action.playerId,
            index: action.index
        })
        expect(visibleAction).not.toHaveProperty('amount')
        expect(visibleAction.forwardPatch).toBeDefined()
        expect(visibleAction.undoPatch).toBeDefined()
        expect(calculateActionChecksum(0, representation.actions)).toBe(
            expectedState.actionChecksum
        )
        const engine = new GameEngine(SyntheticRuntime)
        expect(
            engine.applyProcessedAction({
                action: visibleAction,
                state: expectedBefore,
                game
            })
        ).toEqual(expectedState)
        expect(
            engine.undoProcessedAction({
                action: visibleAction,
                state: expectedState
            })
        ).toEqual(expectedBefore)
        expect(JSON.stringify(representation)).not.toContain('canonical-hidden-token')
    })

    it('includes an Action payload when the authenticated User is its Player', () => {
        const { game, after, action } = syntheticHistory
        const representation = createGameRepresentation({
            game,
            actions: [action],
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-3')
        })

        expect(representation.perspective).toEqual({ kind: 'player', playerId: 'p3' })
        expect(representation.game.state).toEqual(
            SyntheticRuntime.visibility.state.project(after, {
                kind: 'player',
                playerId: 'p3'
            })
        )
        expect(representation.actions[0]).toHaveProperty('amount', 7)
    })

    it('uses the spectator projection when the authenticated User is not a Player', () => {
        const { game, after, action } = syntheticHistory
        const representation = createGameRepresentation({
            game,
            actions: [action],
            visibility: SyntheticRuntime.visibility,
            user: createUser('spectator-user')
        })
        const expectedState = SyntheticRuntime.visibility.state.project(after, {
            kind: 'spectator'
        })

        expect(representation.perspective).toEqual({ kind: 'spectator' })
        expect(representation.game.state).toEqual(expectedState)
        expect(expectedState.currentAuction?.participants).toEqual([
            { playerId: 'p1', passed: false },
            { playerId: 'p2', passed: false },
            { playerId: 'p3', passed: false }
        ])
        expect(representation.actions[0]).not.toHaveProperty('amount')
    })

    it('preserves canonical delivery for a Game Title without visibility registration', () => {
        const { game, action } = structuredClone(syntheticHistory)
        delete game.protectedInformation
        const actions = [action]
        const representation = createGameRepresentation({
            game,
            actions,
            user: createUser('user-1')
        })

        expect(representation).toEqual({ game, actions, perspective: undefined })
        expect(representation.game).toBe(game)
        expect(representation.actions).toBe(actions)
        expect(representation.actions[0]).toHaveProperty('amount', 7)
        expect(representation.actions[0]?.undoPatch).toBe(action.undoPatch)
    })

    it('preserves canonical state and Action History for Host View', () => {
        const { game, action } = syntheticHistory
        const actions = [action]
        const representation = createGameRepresentation({
            game,
            actions,
            hostView: true,
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-1')
        })

        expect(representation).toEqual({ game, actions, perspective: undefined })
        expect(representation.game).toBe(game)
        expect(representation.actions).toBe(actions)
        expect(representation.actions[0]).toHaveProperty('amount', 7)
        expect(representation.actions[0]?.undoPatch).toBe(action.undoPatch)
    })

    it('preserves canonical state and Action History for a hotseat Game', () => {
        const game = structuredClone(syntheticHistory.game)
        game.hotseat = true
        const actions = [syntheticHistory.action]
        const representation = createGameRepresentation({
            game,
            actions,
            visibility: SyntheticRuntime.visibility,
            user: createUser('spectator-user')
        })

        expect(representation).toEqual({ game, actions, perspective: undefined })
        expect(representation.game).toBe(game)
        expect(representation.actions).toBe(actions)
        expect(representation.actions[0]).toHaveProperty('amount', 7)
    })

    it('keeps a participating Game without state private and fails closed on orphaned Actions', () => {
        const game = structuredClone(syntheticHistory.game)
        Reflect.deleteProperty(game, 'state')
        const user = createUser('user-1')

        const representation = createGameRepresentation({
            game,
            actions: [],
            visibility: SyntheticRuntime.visibility,
            user
        })

        expect(representation).toEqual({
            game,
            actions: [],
            perspective: { kind: 'player', playerId: 'p1' }
        })
        expect(representation.game).not.toBe(game)
        expect(() =>
            createGameRepresentation({
                game,
                actions: [syntheticHistory.action],
                visibility: SyntheticRuntime.visibility,
                user
            })
        ).toThrow('Cannot project Game game-1 Action History without its current state')
    })
})

describe('createGameSyncRepresentation', () => {
    it('projects a synchronization suffix with safe patches for the authenticated Player', () => {
        const { game, before, after, action } = syntheticHistory
        const representation = createGameSyncRepresentation({
            game,
            status: GameSyncStatus.InSync,
            actions: [action],
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-1')
        })

        expect(representation.status).toBe(GameSyncStatus.InSync)
        expect(representation.checksum).toBe(after.actionChecksum)
        expect(representation.actions).toHaveLength(1)

        const representedAction = representation.actions[0]
        if (representedAction === undefined) {
            throw Error('Expected one represented synchronization Action')
        }
        expect(representedAction).not.toHaveProperty('amount')
        expect(representedAction.forwardPatch).toBeDefined()
        expect(representedAction.undoPatch).toBeDefined()

        const perspective = { kind: 'player', playerId: 'p1' } as const
        const engine = new GameEngine(SyntheticRuntime)
        expect(
            engine.applyProcessedAction({
                action: representedAction,
                state: SyntheticRuntime.visibility.state.project(before, perspective),
                game
            })
        ).toEqual(SyntheticRuntime.visibility.state.project(after, perspective))
        expect(JSON.stringify(representation)).not.toContain('canonical-hidden-token')
    })

    it('retains a private Action payload for its authenticated Player', () => {
        const { game, action } = syntheticHistory
        const representation = createGameSyncRepresentation({
            game,
            status: GameSyncStatus.OutOfSync,
            actions: [action],
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-3')
        })

        expect(representation.actions[0]).toHaveProperty('amount', 7)
    })

    it('preserves the existing canonical synchronization result without visibility', () => {
        const { game, after, action } = structuredClone(syntheticHistory)
        delete game.protectedInformation
        const actions = [action]
        const representation = createGameSyncRepresentation({
            game,
            status: GameSyncStatus.OutOfSync,
            actions,
            user: createUser('user-1')
        })

        expect(representation).toEqual({
            status: GameSyncStatus.OutOfSync,
            actions,
            checksum: after.actionChecksum
        })
        expect(representation.actions).toBe(actions)
        expect(representation.actions[0]).toHaveProperty('amount', 7)
    })

    it('represents an empty projected suffix without canonical history data', () => {
        const { game, after } = syntheticHistory
        const representation = createGameSyncRepresentation({
            game,
            status: GameSyncStatus.OutOfSync,
            actions: [],
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-1')
        })

        expect(representation).toEqual({
            status: GameSyncStatus.OutOfSync,
            actions: [],
            checksum: after.actionChecksum
        })
        expect(JSON.stringify(representation)).not.toContain('canonical-hidden-token')
    })
})

describe('createActionResultsRepresentation', () => {
    it('projects persisted Action records and safe patches for the authenticated Player', () => {
        const { game, before, after, action } = syntheticHistory
        const storedAction = {
            ...structuredClone(action),
            createdAt: new Date('2026-09-03T12:00:00.000Z'),
            updatedAt: new Date('2026-09-03T12:00:00.000Z')
        }
        const representation = createActionResultsRepresentation({
            game,
            result: {
                processedActions: [action],
                updatedState: after,
                indexOffset: 0,
                actionCascade: {
                    before,
                    transitions: [{ action, after }]
                }
            },
            storedActions: [storedAction],
            missingActions: [],
            priorState: before,
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-1')
        })

        expect(representation.game).toEqual(withoutGameState(game))
        expect(representation.game).not.toBe(game)
        expect(representation.perspective).toEqual({ kind: 'player', playerId: 'p1' })
        expect(representation.missingActions).toBeUndefined()
        expect(representation.actions).toHaveLength(1)

        const representedAction = representation.actions[0]
        if (representedAction === undefined) {
            throw Error('Expected one represented Action')
        }
        expect(representedAction.createdAt).toEqual(storedAction.createdAt)
        expect(representedAction.updatedAt).toEqual(storedAction.updatedAt)
        expect(representedAction).not.toHaveProperty('amount')

        const perspective = { kind: 'player', playerId: 'p1' } as const
        const expectedBefore = SyntheticRuntime.visibility.state.project(before, perspective)
        const expectedAfter = SyntheticRuntime.visibility.state.project(after, perspective)
        const engine = new GameEngine(SyntheticRuntime)
        expect(
            engine.applyProcessedAction({
                action: representedAction,
                state: expectedBefore,
                game
            })
        ).toEqual(expectedAfter)
        expect(
            engine.undoProcessedAction({
                action: representedAction,
                state: expectedAfter
            })
        ).toEqual(expectedBefore)
        expect(JSON.stringify(representation)).not.toContain('canonical-hidden-token')
    })

    it('retains the submitting Player Action payload', () => {
        const { game, before, after, action } = syntheticHistory
        const representation = createActionResultsRepresentation({
            game,
            result: {
                processedActions: [action],
                updatedState: after,
                indexOffset: 0,
                actionCascade: {
                    before,
                    transitions: [{ action, after }]
                }
            },
            storedActions: [structuredClone(action)],
            missingActions: [],
            priorState: before,
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-3')
        })

        expect(representation.perspective).toEqual({ kind: 'player', playerId: 'p3' })
        expect(representation.actions[0]).toHaveProperty('amount', 7)
    })

    it('projects a missing persisted suffix ending at the prior state', () => {
        const { game, after, action } = syntheticHistory
        const representation = createActionResultsRepresentation({
            game,
            result: {
                processedActions: [],
                updatedState: after,
                indexOffset: 0,
                actionCascade: {
                    before: after,
                    transitions: []
                }
            },
            storedActions: [],
            missingActions: [action],
            priorState: after,
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-1')
        })

        expect(representation.actions).toEqual([])
        expect(representation.missingActions).toHaveLength(1)
        expect(representation.missingActions?.[0]).not.toHaveProperty('amount')
        expect(representation.missingActions?.[0]?.forwardPatch).toBeDefined()
        expect(representation.missingActions?.[0]?.undoPatch).toBeDefined()
    })

    it('preserves canonical persisted Actions for a Game Title without visibility', () => {
        const { game, before, after, action } = structuredClone(syntheticHistory)
        const storedActions = [structuredClone(action)]
        const missingActions = [structuredClone(action)]
        delete game.protectedInformation
        const representation = createActionResultsRepresentation({
            game,
            result: {
                processedActions: [action],
                updatedState: after,
                indexOffset: 0,
                actionCascade: {
                    before,
                    transitions: [{ action, after }]
                }
            },
            storedActions,
            missingActions,
            priorState: before,
            user: createUser('user-1')
        })

        expect(representation).toEqual({
            game: withoutGameState(game),
            actions: storedActions,
            missingActions,
            perspective: undefined
        })
        expect(representation.actions).toBe(storedActions)
        expect(representation.actions[0]).toHaveProperty('amount', 7)
        expect(representation.actions[0]?.undoPatch).toEqual(action.undoPatch)
    })

    it('preserves canonical persisted Actions for a hotseat Game', () => {
        const { before, after, action } = syntheticHistory
        const game = structuredClone(syntheticHistory.game)
        game.hotseat = true
        const storedActions = [structuredClone(action)]
        const representation = createActionResultsRepresentation({
            game,
            result: {
                processedActions: [action],
                updatedState: after,
                indexOffset: 0,
                actionCascade: {
                    before,
                    transitions: [{ action, after }]
                }
            },
            storedActions,
            missingActions: [],
            priorState: before,
            visibility: SyntheticRuntime.visibility,
            user: createUser('spectator-user')
        })

        expect(representation).toEqual({
            game: withoutGameState(game),
            actions: storedActions,
            missingActions: undefined,
            perspective: undefined
        })
        expect(representation.actions).toBe(storedActions)
        expect(representation.actions[0]).toHaveProperty('amount', 7)
    })
})

describe('createUndoResultsRepresentation', () => {
    it('projects the complete replacement suffix and omits canonical undo data', () => {
        const { game, before, after, action } = syntheticHistory
        const representation = createUndoResultsRepresentation({
            game,
            actionReplay: { startIndex: 0, actions: [action] },
            undoneActions: [action],
            redoneActions: [action],
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-1')
        })

        expect(representation.game).toEqual(withoutGameState(game))
        expect(representation.perspective).toEqual({ kind: 'player', playerId: 'p1' })
        expect(representation.checksum).toBe(after.actionChecksum)
        expect(representation.undoneActions).toBeUndefined()
        expect(representation.actionReplay.actions).toHaveLength(1)
        expect(representation.actionReplay.actions[0]).not.toHaveProperty('amount')
        expect(representation.actionReplay.actions[0]?.forwardPatch).toBeDefined()
        expect(representation.actionReplay.actions[0]?.undoPatch).toBeDefined()
        expect(representation.redoneActions?.[0]).not.toHaveProperty('amount')
        expect(representation.canonicalReplay.actions).toEqual(representation.actionReplay.actions)
        expect(representation.canonicalReplay.userActions[0]).not.toHaveProperty('undoPatch')

        const perspective = { kind: 'player', playerId: 'p1' } as const
        const representedAction = representation.actionReplay.actions[0]
        if (representedAction === undefined) {
            throw Error('Expected one represented replacement Action')
        }
        const engine = new GameEngine(SyntheticRuntime)
        expect(
            engine.applyProcessedAction({
                action: representedAction,
                state: SyntheticRuntime.visibility.state.project(before, perspective),
                game
            })
        ).toEqual(SyntheticRuntime.visibility.state.project(after, perspective))
        expect(JSON.stringify(representation)).not.toContain('canonical-hidden-token')
    })

    it('retains a private replacement Action payload for its authenticated Player', () => {
        const { game, action } = syntheticHistory
        const representation = createUndoResultsRepresentation({
            game,
            actionReplay: { startIndex: 0, actions: [action] },
            undoneActions: [action],
            redoneActions: [action],
            visibility: SyntheticRuntime.visibility,
            user: createUser('user-3')
        })

        expect(representation.perspective).toEqual({ kind: 'player', playerId: 'p3' })
        expect(representation.actionReplay.actions[0]).toHaveProperty('amount', 7)
        expect(representation.redoneActions?.[0]).toHaveProperty('amount', 7)
    })

    it('preserves the legacy undo result for a Game Title without visibility', () => {
        const { game, after, action } = structuredClone(syntheticHistory)
        const actionReplay = { startIndex: 0, actions: [action] }
        const undoneActions = [action]
        const redoneActions = [action]
        delete game.protectedInformation
        const representation = createUndoResultsRepresentation({
            game,
            actionReplay,
            undoneActions,
            redoneActions,
            user: createUser('user-1')
        })

        expect(representation.game).toEqual(withoutGameState(game))
        expect(representation.canonicalReplay.startIndex).toBe(0)
        expect(representation.canonicalReplay.actions).toEqual([action])
        expect(representation.canonicalReplay.userActions).toHaveLength(1)
        expect(representation.canonicalReplay.userActions[0]).not.toHaveProperty('undoPatch')
        expect(representation.checksum).toBe(after.actionChecksum)
        expect(representation.perspective).toBeUndefined()
        expect(representation.actionReplay).toBe(actionReplay)
        expect(representation.undoneActions).toBe(undoneActions)
        expect(representation.redoneActions).toBe(redoneActions)
    })
})

describe('configuration policies without a replay runtime', () => {
    it.each([false, true])(
        'projects load, sync, results, and undo with hiddenMoney=%s',
        (hiddenMoney) => {
            const { game, before, after, action } = structuredClone(syntheticHistory)
            game.config = { hiddenMoney }
            const canonicalBefore = { ...before, money: 12 }
            const canonicalAfter = { ...after, money: 11 }
            action.undoPatch?.push({ op: 'replace', path: '/money', value: 12 })
            game.state = canonicalAfter
            const visibility = {
                state: Visibility.createProjector(
                    Type.Object({
                        ...GameState.properties,
                        money: Type.Optional(
                            Visibility.protect(Type.Number(), {
                                policy: Visibility.Policy.configEquals('hiddenMoney', false)
                            })
                        )
                    })
                ),
                actions: SyntheticRuntime.visibility.actions
            }
            const options = { game, visibility, user: createUser('user-1') }
            const actions = [action]
            const loaded = createGameRepresentation({ ...options, actions })
            expect(Object.hasOwn(loaded.game.state ?? {}, 'money')).toBe(!hiddenMoney)
            const synced = createGameSyncRepresentation({
                ...options,
                actions,
                status: GameSyncStatus.InSync
            })
            const result = createActionResultsRepresentation({
                ...options,
                result: {
                    processedActions: actions,
                    updatedState: canonicalAfter,
                    indexOffset: 0,
                    actionCascade: {
                        before: canonicalBefore,
                        transitions: [{ action, after: canonicalAfter }]
                    }
                },
                storedActions: actions,
                missingActions: [],
                priorState: canonicalBefore
            })
            const undo = createUndoResultsRepresentation({
                ...options,
                actionReplay: { startIndex: 0, actions },
                undoneActions: actions,
                redoneActions: []
            })
            for (const records of [
                loaded.actions,
                synced.actions,
                result.actions,
                undo.actionReplay.actions
            ]) {
                expect(records).toHaveLength(1)
                expect(records[0].undoPatch?.some((patch) => patch.path === '/money')).toBe(
                    !hiddenMoney
                )
                expect(records[0].forwardPatch?.some((patch) => patch.path === '/money')).toBe(
                    !hiddenMoney
                )
            }
        }
    )
})
