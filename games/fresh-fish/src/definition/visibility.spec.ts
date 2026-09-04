import {
    ActionSource,
    AuctionType,
    type Game,
    GameEngine,
    GameStatus,
    HydratedSimultaneousAuction,
    PlayerStatus,
    SimultaneousAuction,
    SimultaneousAuctionVisibility,
    TieResolutionStrategy,
    Visibility
} from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { TileBag, TileBagProjection } from '../components/tileBag.js'
import { FreshFishGameState, FreshFishGameStateProjection } from '../model/gameState.js'
import { PlaceBid, PlaceBidProjection } from '../actions/placeBid.js'
import type { PlaceDisk } from '../actions/placeDisk.js'
import { ActionType } from './actions.js'
import { TileType } from '../components/tiles.js'
import { CellType } from '../components/cells.js'
import { MachineState } from './states.js'
import { generateTestState } from '../util/testHelper.js'
import { FreshFishRuntime } from './runtime.js'
import { GoodsType } from './goodsType.js'

function createCanonicalAuctionState(): FreshFishGameState {
    const state = generateTestState({ numPlayers: 3 })
    state.machineState = MachineState.AuctioningTile
    state.currentAuction = new HydratedSimultaneousAuction({
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
    return state.dehydrate()
}

function createGame(state: FreshFishGameState): Game {
    return {
        id: state.gameId,
        typeId: 'freshfish',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'owner-1',
        name: 'Visibility Test',
        players: state.players.map((player, index) => ({
            id: player.playerId,
            name: `Player ${index + 1}`,
            isHuman: false,
            status: PlayerStatus.Joined
        })),
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        createdAt: new Date(0)
    }
}

function findEmptyCoords(state: ReturnType<typeof generateTestState>): PlaceDisk['coords'] {
    for (const candidate of state.board) {
        if (candidate.cell.type === CellType.Empty) {
            return candidate.coords
        }
    }
    throw Error('Expected an empty board cell')
}

describe('Fresh Fish visibility', () => {
    it('protects tile identities while retaining the public bag count', () => {
        expect(TileBag.properties.items[Visibility.MetadataKey]).toMatchObject({
            policy: Visibility.Policy.HostOnly,
            redaction: {
                kind: 'replace',
                adapter: 'tabletop.empty-array'
            }
        })
        expect(TileBag.required).toEqual(['items', 'remaining'])
        expect(TileBagProjection.required).toEqual(['items', 'remaining'])
        expect(Compile(TileBagProjection).Check({ items: [], remaining: 20 })).toBe(true)
        expectTypeOf<typeof TileBagProjection>().toEqualTypeOf<
            Visibility.ProjectedSchema<typeof TileBag>
        >()
    })

    it('projects a tile bag to its public count without exposing tile identities or order', () => {
        const canonical: TileBag = {
            items: [
                { type: TileType.Market, test: 'first-hidden-tile' },
                { type: TileType.Market, test: 'second-hidden-tile' }
            ],
            remaining: 2
        }

        const projector = Visibility.createProjector(TileBag)
        const playerProjection = projector.project(canonical, {
            kind: 'player',
            playerId: 'player-1'
        })
        const spectatorProjection = projector.project(canonical, { kind: 'spectator' })

        expect(playerProjection).toEqual({ items: [], remaining: 2 })
        expect(spectatorProjection).toEqual(playerProjection)
        expect(canonical.items).toHaveLength(2)
        expect(Compile(projector.schema).Check(playerProjection)).toBe(true)
        expect(Compile(projector.schema).Check(spectatorProjection)).toBe(true)
    })

    it('inherits scoped sealed-bid visibility from the shared simultaneous auction', () => {
        const SimultaneousAuctionProjection = Visibility.createProjectionSchema(SimultaneousAuction)

        expect(
            SimultaneousAuction.properties.participants.items.properties.bid[Visibility.MetadataKey]
        ).toEqual({
            policy: SimultaneousAuctionVisibility.Policy.Bid,
            redaction: { kind: 'omit' }
        })
        expect(Reflect.get(FreshFishGameState.properties.currentAuction, Visibility.ScopeKey)).toBe(
            SimultaneousAuctionVisibility.Scope
        )
        expectTypeOf<FreshFishGameState['currentAuction']>().toEqualTypeOf<
            SimultaneousAuction | undefined
        >()

        const auction = {
            id: 'auction-1',
            type: AuctionType.Simultaneous,
            participants: [
                { playerId: 'player-1', bid: 3, passed: false },
                { playerId: 'player-2', passed: false }
            ],
            tie: false,
            tieResolution: TieResolutionStrategy.FirstInOrder
        }

        expect(Compile(SimultaneousAuctionProjection).Check(auction)).toBe(true)
        expect(
            SimultaneousAuctionProjection.properties.participants.items.properties.bid[
                Visibility.MetadataKey
            ]
        ).toEqual({
            policy: SimultaneousAuctionVisibility.Policy.Bid,
            redaction: { kind: 'omit' }
        })
    })

    it('projects a PlaceBid amount only to its attributed Player', () => {
        const canonicalAction: PlaceBid = {
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId: 'player-1',
            amount: 7
        }
        const redactedAction: PlaceBidProjection = {
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId: 'player-1'
        }

        expect(PlaceBid.properties.amount[Visibility.MetadataKey]).toEqual({
            policy: Visibility.Policy.Actor,
            redaction: { kind: 'omit' }
        })
        expect(Reflect.get(PlaceBid.properties.undoPatch, Visibility.MetadataKey)).toEqual({
            policy: Visibility.Policy.HostOnly,
            redaction: { kind: 'omit' }
        })
        expect(Compile(PlaceBid).Check(canonicalAction)).toBe(true)
        expect(Compile(PlaceBid).Check(redactedAction)).toBe(false)
        expect(Compile(PlaceBidProjection).Check(canonicalAction)).toBe(true)
        expect(Compile(PlaceBidProjection).Check(redactedAction)).toBe(true)
        expect(PlaceBid.required).toContain('amount')
        expect(PlaceBidProjection.required).not.toContain('amount')

        const projector = Visibility.createProjector(PlaceBid)
        expect(
            projector.project(canonicalAction, {
                kind: 'player',
                playerId: 'player-1'
            })
        ).toEqual(canonicalAction)
        expect(
            projector.project(canonicalAction, {
                kind: 'player',
                playerId: 'player-2'
            })
        ).toEqual(redactedAction)
        expect(projector.project(canonicalAction, { kind: 'spectator' })).toEqual(redactedAction)
    })

    it('materializes Player-relative PlaceBid transitions with safe patches', () => {
        const before = createCanonicalAuctionState()
        const after = structuredClone(before)
        const auction = after.currentAuction
        if (auction === undefined) {
            throw Error('Expected a current auction')
        }
        auction.participants[2].bid = 7

        const action: PlaceBid = {
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId: 'p3',
            amount: 7,
            index: 12,
            undoPatch: [
                {
                    op: 'replace',
                    path: '/currentAuction/participants/2/bid',
                    value: 7654321
                }
            ]
        }
        const result = {
            processedActions: [action],
            updatedState: after,
            indexOffset: 0,
            actionCascade: { before, transitions: [{ action, after }] }
        }
        const actorPerspective: Visibility.Perspective = { kind: 'player', playerId: 'p3' }
        const opponentPerspective: Visibility.Perspective = { kind: 'player', playerId: 'p1' }
        const spectatorPerspective: Visibility.Perspective = { kind: 'spectator' }
        const actorResult = Visibility.projectActionResult({
            result,
            visibility: FreshFishRuntime.visibility,
            perspective: actorPerspective
        })
        const opponentResult = Visibility.projectActionResult({
            result,
            visibility: FreshFishRuntime.visibility,
            perspective: opponentPerspective
        })
        const spectatorResult = Visibility.projectActionResult({
            result,
            visibility: FreshFishRuntime.visibility,
            perspective: spectatorPerspective
        })
        const actorAction = actorResult.processedActions[0]
        const opponentAction = opponentResult.processedActions[0]
        const spectatorAction = spectatorResult.processedActions[0]
        if (
            actorAction === undefined ||
            opponentAction === undefined ||
            spectatorAction === undefined
        ) {
            throw Error('Expected one projected Action per Action cascade')
        }

        expect(actorAction).toEqual({
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId: 'p3',
            amount: 7,
            index: 12,
            forwardPatch: [
                {
                    op: 'add',
                    path: '/currentAuction/participants/2/bid',
                    value: 7
                }
            ],
            undoPatch: [
                {
                    op: 'remove',
                    path: '/currentAuction/participants/2/bid'
                }
            ]
        })

        const redactedAction = {
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId: 'p3',
            index: 12,
            forwardPatch: [],
            undoPatch: []
        }
        expect(opponentAction).toEqual(redactedAction)
        expect(spectatorAction).toEqual(redactedAction)
        expect(actorResult.updatedState).toEqual(
            FreshFishRuntime.visibility.state.project(after, actorPerspective)
        )
        expect(opponentResult.updatedState).toEqual(
            FreshFishRuntime.visibility.state.project(after, opponentPerspective)
        )
        expect(spectatorResult.updatedState).toEqual(
            FreshFishRuntime.visibility.state.project(after, spectatorPerspective)
        )
        expect(actorResult.updatedState.currentAuction?.participants[2].bid).toBe(7)
        expect(opponentResult.updatedState.currentAuction?.participants[2].bid).toBeUndefined()
        expect(spectatorResult.updatedState.currentAuction?.participants[2].bid).toBeUndefined()
        expect(actorResult.updatedState.tileBag.items).toEqual([])
        expect(opponentResult.updatedState.tileBag.items).toEqual([])
        expect(spectatorResult.updatedState.tileBag.items).toEqual([])
        expect(actorResult.indexOffset).toBe(0)
        expect(opponentResult.indexOffset).toBe(0)
        expect(spectatorResult.indexOffset).toBe(0)
        expect(actorResult).not.toHaveProperty('actionCascade')
        expect(opponentResult).not.toHaveProperty('actionCascade')
        expect(spectatorResult).not.toHaveProperty('actionCascade')
        expect(JSON.stringify(opponentResult)).not.toContain('7654321')
        expect(JSON.stringify(spectatorResult)).not.toContain('7654321')
        expect(action.undoPatch).toEqual([
            {
                op: 'replace',
                path: '/currentAuction/participants/2/bid',
                value: 7654321
            }
        ])
    })

    it('captures a complete canonical Action cascade from Game Engine execution', () => {
        const before = createCanonicalAuctionState()
        before.activePlayerIds = ['p3']
        before.chosenTile = { type: TileType.Stall, goodsType: GoodsType.Fish }

        const action: PlaceBid = {
            id: 'action-1',
            gameId: before.gameId,
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId: 'p3',
            amount: 7,
            undoPatch: [{ op: 'replace', path: '/actionCount', value: 999 }],
            forwardPatch: [{ op: 'replace', path: '/actionCount', value: 999 }]
        }
        Reflect.set(action, 'metadata', { submitted: 'not-authoritative' })
        const engine = new GameEngine(FreshFishRuntime)
        const game = createGame(before)
        const result = engine.executeAction({ action, state: before, game })

        expect(result.actionCascade.before).toEqual(before)
        expect(result.actionCascade.before).not.toBe(before)
        expect(
            result.actionCascade.transitions.map((transition) => transition.action.type)
        ).toEqual([ActionType.PlaceBid, ActionType.EndAuction, ActionType.PlaceStall])
        expect(
            result.actionCascade.transitions.map((transition) => transition.action.source)
        ).toEqual([ActionSource.User, ActionSource.System, ActionSource.System])
        expect(
            result.actionCascade.transitions.map((transition) => transition.after.machineState)
        ).toEqual([
            MachineState.AuctioningTile,
            MachineState.AuctionEnded,
            MachineState.StartOfTurn
        ])
        expect(
            result.actionCascade.transitions.map((transition) => transition.after.actionCount)
        ).toEqual([1, 2, 3])
        expect(result.processedActions).toEqual(
            result.actionCascade.transitions.map((transition) => transition.action)
        )

        let previousState = result.actionCascade.before
        for (const transition of result.actionCascade.transitions) {
            expect(
                engine.undoProcessedAction({
                    action: transition.action,
                    state: transition.after
                })
            ).toEqual(previousState)
            previousState = transition.after
        }
        expect(result.updatedState).toEqual(previousState)
        expect(before.currentAuction?.participants[2].bid).toBeUndefined()
        expect(result.processedActions[0]?.forwardPatch).toBeUndefined()
        expect(result.processedActions[0]?.undoPatch).not.toEqual(action.undoPatch)
        expect(Reflect.get(result.processedActions[0] ?? {}, 'metadata')).toBeUndefined()
        expect(Reflect.get(result.processedActions[1] ?? {}, 'metadata')).toBeDefined()
        expect(action.forwardPatch).toBeDefined()
        expect(Reflect.get(action, 'metadata')).toEqual({ submitted: 'not-authoritative' })

        const firstTransition = result.actionCascade.transitions[0]
        if (firstTransition === undefined) {
            throw Error('Expected the initiating Action transition')
        }
        expect(
            engine.applyProcessedAction({
                action: firstTransition.action,
                state: result.actionCascade.before,
                game
            })
        ).toEqual(firstTransition.after)

        const perspective: Visibility.Perspective = { kind: 'player', playerId: 'p3' }
        const visibleResult = Visibility.projectActionResult({
            result,
            visibility: FreshFishRuntime.visibility,
            perspective,
            replay: { game, runtime: FreshFishRuntime }
        })
        expect(visibleResult.processedActions.map((visibleAction) => visibleAction.type)).toEqual([
            ActionType.PlaceBid,
            ActionType.EndAuction,
            ActionType.PlaceStall
        ])
        expect(
            visibleResult.processedActions.every((visibleAction) => visibleAction.undoPatch)
        ).toBe(true)
        expect(
            visibleResult.processedActions.every(
                (visibleAction) => visibleAction.forwardPatch !== undefined
            )
        ).toBe(true)
        expect(visibleResult.updatedState).toEqual(
            FreshFishRuntime.visibility.state.project(result.updatedState, perspective)
        )
        expect(visibleResult).not.toHaveProperty('actionCascade')

        expect(
            Visibility.projectActionHistory({
                currentState: result.updatedState,
                actions: result.processedActions,
                visibility: FreshFishRuntime.visibility,
                perspective,
                replay: { game, runtime: FreshFishRuntime }
            })
        ).toEqual({
            startIndex: 0,
            currentState: visibleResult.updatedState,
            actions: visibleResult.processedActions
        })

        const projectedSystemSuffix = Visibility.projectActionHistory({
            currentState: result.updatedState,
            actions: result.processedActions.slice(1),
            startIndex: 1,
            visibility: FreshFishRuntime.visibility,
            perspective,
            replay: { game, runtime: FreshFishRuntime }
        })
        expect(
            projectedSystemSuffix.actions.every(
                (visibleAction) => visibleAction.forwardPatch !== undefined
            )
        ).toBe(true)

        const visibleBefore = FreshFishRuntime.visibility.state.project(before, perspective)
        const firstVisibleAction = visibleResult.processedActions[0]
        if (firstVisibleAction === undefined) {
            throw Error('Expected the initiating visible Action')
        }
        expect(
            engine.applyProcessedAction({
                action: firstVisibleAction,
                state: visibleBefore,
                game
            })
        ).toEqual(
            FreshFishRuntime.visibility.state.project(firstTransition.after, {
                kind: 'player',
                playerId: 'p3'
            })
        )

        const opaqueAction = {
            id: 'opaque-action',
            gameId: before.gameId,
            source: ActionSource.System,
            type: '__redacted__',
            forwardPatch: []
        }
        expect(engine.applyProcessedAction({ action: opaqueAction, state: before, game })).toEqual(
            before
        )

        const rebuiltAction = engine.rebuildProcessedAction({ action, state: before, game })
        expect(rebuiltAction.processedActions).toHaveLength(1)
    })

    it('omits forward patches after proving a public cascade replayable', () => {
        const state = generateTestState({ numPlayers: 3 })
        const playerId = state.turnManager.startNextTurn(state.actionCount)
        state.activePlayerIds = [playerId]

        const before = state.dehydrate()
        const game = createGame(before)
        const action: PlaceDisk = {
            id: 'place-disk-1',
            gameId: before.gameId,
            source: ActionSource.User,
            type: ActionType.PlaceDisk,
            playerId,
            coords: findEmptyCoords(state)
        }
        const engine = new GameEngine(FreshFishRuntime)
        const result = engine.executeAction({ action, state: before, game })
        const perspective: Visibility.Perspective = { kind: 'player', playerId }

        const visibleResult = Visibility.projectActionResult({
            result,
            visibility: FreshFishRuntime.visibility,
            perspective,
            replay: { game, runtime: FreshFishRuntime }
        })
        const visibleAction = visibleResult.processedActions[0]
        if (visibleAction === undefined) {
            throw Error('Expected a projected PlaceDisk Action')
        }

        expect(visibleResult.processedActions).toHaveLength(1)
        expect(visibleAction.forwardPatch).toBeUndefined()
        expect(visibleAction.undoPatch).toBeDefined()
        expect(
            engine.applyProcessedAction({
                action: visibleAction,
                state: FreshFishRuntime.visibility.state.project(before, perspective),
                game
            })
        ).toEqual(FreshFishRuntime.visibility.state.project(result.updatedState, perspective))

        const secondState = FreshFishRuntime.hydrator.hydrateState(result.updatedState)
        const secondPlayerId = secondState.activePlayerIds[0]
        if (secondPlayerId === undefined) {
            throw Error('Expected a second active Player')
        }
        const secondAction: PlaceDisk = {
            id: 'place-disk-2',
            gameId: before.gameId,
            source: ActionSource.User,
            type: ActionType.PlaceDisk,
            playerId: secondPlayerId,
            coords: findEmptyCoords(secondState)
        }
        const secondResult = engine.executeAction({
            action: secondAction,
            state: result.updatedState,
            game
        })
        const projectedHistory = Visibility.projectActionHistory({
            currentState: secondResult.updatedState,
            actions: [...result.processedActions, ...secondResult.processedActions],
            visibility: FreshFishRuntime.visibility,
            perspective,
            replay: { game, runtime: FreshFishRuntime }
        })

        expect(projectedHistory.actions).toHaveLength(2)
        expect(
            projectedHistory.actions.every(
                (historyAction) => historyAction.forwardPatch === undefined
            )
        ).toBe(true)
    })

    it('carries the bag and bid declarations into the full state projection', () => {
        expect(
            Reflect.get(
                FreshFishGameState.properties.tileBag.properties.items,
                Visibility.MetadataKey
            )
        ).toBeDefined()
        expect(
            Reflect.get(
                FreshFishGameState.properties.currentAuction.properties.participants.items
                    .properties.bid,
                Visibility.MetadataKey
            )
        ).toBeDefined()
        expect(
            Reflect.get(
                FreshFishGameStateProjection.properties.currentAuction.properties.participants.items
                    .properties.bid,
                Visibility.MetadataKey
            )
        ).toBeDefined()
        expect(
            Reflect.get(FreshFishGameStateProjection.properties.currentAuction, Visibility.ScopeKey)
        ).toBe(SimultaneousAuctionVisibility.Scope)
        expect(FreshFishRuntime.visibility.state.schema).toEqual(FreshFishGameStateProjection)
        expectTypeOf<typeof FreshFishRuntime.visibility.state.schema>().toEqualTypeOf<
            typeof FreshFishGameStateProjection
        >()
    })

    it('projects current auction bids through the registered Game Runtime visibility', () => {
        const canonical = createCanonicalAuctionState()
        const projector = FreshFishRuntime.visibility.state

        const playerOneProjection = projector.project(canonical, {
            kind: 'player',
            playerId: 'p1'
        })
        const playerTwoProjection = projector.project(canonical, {
            kind: 'player',
            playerId: 'p2'
        })
        const spectatorProjection = projector.project(canonical, { kind: 'spectator' })

        expect(playerOneProjection.currentAuction?.participants).toEqual([
            { playerId: 'p1', bid: 3, passed: false },
            { playerId: 'p2', passed: false },
            { playerId: 'p3', passed: false }
        ])
        expect(playerTwoProjection.currentAuction?.participants).toEqual([
            { playerId: 'p1', passed: false },
            { playerId: 'p2', bid: 5, passed: false },
            { playerId: 'p3', passed: false }
        ])
        expect(spectatorProjection.currentAuction?.participants).toEqual([
            { playerId: 'p1', passed: false },
            { playerId: 'p2', passed: false },
            { playerId: 'p3', passed: false }
        ])
        expect(playerOneProjection.tileBag.items).toEqual([])
        expect(playerTwoProjection.tileBag.items).toEqual([])
        expect(spectatorProjection.tileBag.items).toEqual([])

        const auction = canonical.currentAuction
        if (auction === undefined) {
            throw Error('Expected a current auction')
        }
        auction.participants[2].bid = 4
        auction.highBid = 5
        auction.winnerId = 'p2'
        const revealedPerspectives: Visibility.Perspective[] = [
            { kind: 'player', playerId: 'p1' },
            { kind: 'player', playerId: 'p2' },
            { kind: 'spectator' }
        ]
        for (const perspective of revealedPerspectives) {
            const projection = projector.project(canonical, perspective)
            expect(projection.currentAuction?.participants).toEqual([
                { playerId: 'p1', bid: 3, passed: false },
                { playerId: 'p2', bid: 5, passed: false },
                { playerId: 'p3', bid: 4, passed: false }
            ])
            expect(projection.tileBag.items).toEqual([])
            expect(Compile(projector.schema).Check(projection)).toBe(true)
        }

        expect(canonical.currentAuction?.participants).toEqual([
            { playerId: 'p1', bid: 3, passed: false },
            { playerId: 'p2', bid: 5, passed: false },
            { playerId: 'p3', bid: 4, passed: false }
        ])
    })
})
