import {
    ActionSource,
    AuctionType,
    HydratedSimultaneousAuction,
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
import { ActionType } from './actions.js'
import { TileType } from '../components/tiles.js'
import { MachineState } from './states.js'
import { generateTestState } from '../util/testHelper.js'
import { FreshFishRuntime } from './runtime.js'

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
        const actorCascade = Visibility.projectActionCascade(
            { before, transitions: [{ action, after }] },
            {
                visibility: FreshFishRuntime.visibility,
                perspective: { kind: 'player', playerId: 'p3' }
            }
        )
        const opponentCascade = Visibility.projectActionCascade(
            { before, transitions: [{ action, after }] },
            {
                visibility: FreshFishRuntime.visibility,
                perspective: { kind: 'player', playerId: 'p1' }
            }
        )
        const spectatorCascade = Visibility.projectActionCascade(
            { before, transitions: [{ action, after }] },
            {
                visibility: FreshFishRuntime.visibility,
                perspective: { kind: 'spectator' }
            }
        )
        const actorTransition = actorCascade.transitions[0]
        const opponentTransition = opponentCascade.transitions[0]
        const spectatorTransition = spectatorCascade.transitions[0]
        if (
            actorTransition === undefined ||
            opponentTransition === undefined ||
            spectatorTransition === undefined
        ) {
            throw Error('Expected one projected transition per Action cascade')
        }

        expect(actorTransition.action).toEqual({
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId: 'p3',
            amount: 7,
            index: 12
        })
        expect(actorTransition.forwardPatch).toEqual([
            {
                op: 'add',
                path: '/currentAuction/participants/2/bid',
                value: 7
            }
        ])
        expect(actorTransition.undoPatch).toEqual([
            {
                op: 'remove',
                path: '/currentAuction/participants/2/bid'
            }
        ])

        const redactedAction = {
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId: 'p3',
            index: 12
        }
        expect(opponentTransition.action).toEqual(redactedAction)
        expect(spectatorTransition.action).toEqual(redactedAction)
        expect(opponentTransition.forwardPatch).toEqual([])
        expect(opponentTransition.undoPatch).toEqual([])
        expect(spectatorTransition.forwardPatch).toEqual([])
        expect(spectatorTransition.undoPatch).toEqual([])
        expect(JSON.stringify(opponentTransition)).not.toContain('7654321')
        expect(JSON.stringify(spectatorTransition)).not.toContain('7654321')
        expect(action.undoPatch?.[0].value).toBe(7654321)
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
