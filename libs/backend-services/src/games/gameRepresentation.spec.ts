import {
    ActionSource,
    AuctionType,
    calculateActionChecksum,
    GameEngine,
    GameStatus,
    HydratedSimultaneousAuction,
    PlayerStatus,
    Role,
    TieResolutionStrategy,
    type User,
    UserStatus
} from '@tabletop/common'
import {
    ActionType,
    Definition as FreshFishDefinition,
    FreshFishRuntime,
    MachineState,
    type PlaceBid
} from '@tabletop/fresh-fish'
import { describe, expect, it, vi } from 'vitest'
import { createGameRepresentation, createGameRepresentationEtag } from './gameRepresentation.js'

function createUser(id: string): User {
    return {
        id,
        status: UserStatus.Active,
        roles: [Role.User],
        externalIds: []
    }
}

function createFreshFishHistory() {
    const game = FreshFishRuntime.initializer.initializeGame(
        {
            id: 'game-1',
            typeId: FreshFishDefinition.info.id,
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
        FreshFishDefinition
    )
    game.status = GameStatus.Started

    const engine = new GameEngine(FreshFishRuntime)
    const hydratedState = (() => {
        const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
        try {
            return FreshFishRuntime.initializer.initializeGameState(
                game,
                engine.generateUninitializedState(game)
            )
        } finally {
            consoleLog.mockRestore()
        }
    })()
    hydratedState.machineState = MachineState.AuctioningTile
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
    const firstTile = before.tileBag.items[0]
    if (firstTile === undefined) {
        throw Error('Expected Fresh Fish to initialize a non-empty tile bag')
    }
    Reflect.set(firstTile, 'test', 'canonical-hidden-tile')

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
        type: ActionType.PlaceBid,
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

const freshFishHistory = createFreshFishHistory()

describe('createGameRepresentationEtag', () => {
    it('preserves the canonical ETag for a Game Title without visibility registration', () => {
        expect(
            createGameRepresentationEtag({
                canonicalEtag: 'canonical-revision',
                game: freshFishHistory.game,
                user: createUser('user-1')
            })
        ).toBe('canonical-revision')
    })

    it('derives stable and distinct ETags for projected perspectives', () => {
        const createEtag = (userId: string, canonicalEtag = 'canonical-revision') =>
            createGameRepresentationEtag({
                canonicalEtag,
                game: freshFishHistory.game,
                visibility: FreshFishRuntime.visibility,
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
                game: freshFishHistory.game,
                hostView: true,
                visibility: FreshFishRuntime.visibility,
                user: createUser('user-1')
            })
        ).toBe('canonical-revision')
    })
})

describe('createGameRepresentation', () => {
    it('projects Fresh Fish state and complete Action History for the authenticated Player', () => {
        const { game, before, after, action } = freshFishHistory
        const representation = createGameRepresentation({
            game,
            actions: [action],
            visibility: FreshFishRuntime.visibility,
            user: createUser('user-1')
        })
        const perspective = { kind: 'player', playerId: 'p1' } as const
        const expectedState = FreshFishRuntime.visibility.state.project(after, perspective)
        const expectedBefore = FreshFishRuntime.visibility.state.project(before, perspective)

        expect(representation.perspective).toEqual(perspective)
        expect(representation.game.state).toEqual(expectedState)
        expect(expectedState.tileBag.items).toEqual([])
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
        const engine = new GameEngine(FreshFishRuntime)
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
        expect(JSON.stringify(representation)).not.toContain('canonical-hidden-tile')
    })

    it('includes an Action payload when the authenticated User is its Player', () => {
        const { game, after, action } = freshFishHistory
        const representation = createGameRepresentation({
            game,
            actions: [action],
            visibility: FreshFishRuntime.visibility,
            user: createUser('user-3')
        })

        expect(representation.perspective).toEqual({ kind: 'player', playerId: 'p3' })
        expect(representation.game.state).toEqual(
            FreshFishRuntime.visibility.state.project(after, {
                kind: 'player',
                playerId: 'p3'
            })
        )
        expect(representation.actions[0]).toHaveProperty('amount', 7)
    })

    it('uses the spectator projection when the authenticated User is not a Player', () => {
        const { game, after, action } = freshFishHistory
        const representation = createGameRepresentation({
            game,
            actions: [action],
            visibility: FreshFishRuntime.visibility,
            user: createUser('spectator-user')
        })
        const expectedState = FreshFishRuntime.visibility.state.project(after, {
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
        const { game, action } = freshFishHistory
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
        const { game, action } = freshFishHistory
        const actions = [action]
        const representation = createGameRepresentation({
            game,
            actions,
            hostView: true,
            visibility: FreshFishRuntime.visibility,
            user: createUser('user-1')
        })

        expect(representation).toEqual({ game, actions, perspective: undefined })
        expect(representation.game).toBe(game)
        expect(representation.actions).toBe(actions)
        expect(representation.actions[0]).toHaveProperty('amount', 7)
        expect(representation.actions[0]?.undoPatch).toBe(action.undoPatch)
    })

    it('keeps a participating Game without state private and fails closed on orphaned Actions', () => {
        const game = structuredClone(freshFishHistory.game)
        Reflect.deleteProperty(game, 'state')
        const user = createUser('user-1')

        const representation = createGameRepresentation({
            game,
            actions: [],
            visibility: FreshFishRuntime.visibility,
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
                actions: [freshFishHistory.action],
                visibility: FreshFishRuntime.visibility,
                user
            })
        ).toThrow('Cannot project Game game-1 Action History without its current state')
    })
})
