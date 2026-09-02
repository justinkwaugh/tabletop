import {
    ActionSource,
    AuctionType,
    HydratedSimultaneousAuction,
    type SimultaneousAuction,
    TieResolutionStrategy,
    Visibility
} from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
    FreshFishAuctionParticipant,
    type FreshFishSimultaneousAuction,
    FreshFishSimultaneousAuctionProjection
} from '../components/auction.js'
import { TileBag, TileBagProjection } from '../components/tileBag.js'
import { FreshFishGameState, FreshFishGameStateProjection } from '../model/gameState.js'
import { PlaceBid, PlaceBidProjection } from '../actions/placeBid.js'
import { ActionType } from './actions.js'
import { FreshFishVisibilityPolicies, FreshFishVisibilityPolicy } from './visibility.js'
import { TileType } from '../components/tiles.js'
import { MachineState } from './states.js'
import { generateTestState } from '../util/testHelper.js'

function createCanonicalAuctionState(): FreshFishGameState {
    const state = generateTestState({ numPlayers: 2 })
    state.machineState = MachineState.AuctioningTile
    state.currentAuction = new HydratedSimultaneousAuction({
        id: 'auction-1',
        type: AuctionType.Simultaneous,
        participants: [
            { playerId: 'p1', bid: 3, passed: false },
            { playerId: 'p2', bid: 5, passed: false }
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

    it('keeps the canonical auction shape while declaring sealed bids', () => {
        expect(FreshFishAuctionParticipant.properties.bid[Visibility.MetadataKey]).toEqual({
            policy: FreshFishVisibilityPolicy.CurrentAuctionBid,
            redaction: { kind: 'omit' }
        })
        expectTypeOf<FreshFishSimultaneousAuction>().toEqualTypeOf<SimultaneousAuction>()

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

        expect(Compile(FreshFishSimultaneousAuctionProjection).Check(auction)).toBe(true)
        expect(
            FreshFishSimultaneousAuctionProjection.properties.participants.items.properties.bid[
                Visibility.MetadataKey
            ]
        ).toEqual({
            policy: FreshFishVisibilityPolicy.CurrentAuctionBid,
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
    })

    it('projects current auction bids for players and spectators before and after reveal', () => {
        const canonical = createCanonicalAuctionState()
        const projector = Visibility.createProjector(FreshFishGameState, {
            policies: FreshFishVisibilityPolicies
        })

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
            { playerId: 'p2', passed: false }
        ])
        expect(playerTwoProjection.currentAuction?.participants).toEqual([
            { playerId: 'p1', passed: false },
            { playerId: 'p2', bid: 5, passed: false }
        ])
        expect(spectatorProjection.currentAuction?.participants).toEqual([
            { playerId: 'p1', passed: false },
            { playerId: 'p2', passed: false }
        ])
        expect(playerOneProjection.tileBag.items).toEqual([])
        expect(playerTwoProjection.tileBag.items).toEqual([])
        expect(spectatorProjection.tileBag.items).toEqual([])

        canonical.machineState = MachineState.AuctionEnded
        const revealedPerspectives: Visibility.Perspective[] = [
            { kind: 'player', playerId: 'p1' },
            { kind: 'player', playerId: 'p2' },
            { kind: 'spectator' }
        ]
        for (const perspective of revealedPerspectives) {
            const projection = projector.project(canonical, perspective)
            expect(projection.currentAuction?.participants).toEqual([
                { playerId: 'p1', bid: 3, passed: false },
                { playerId: 'p2', bid: 5, passed: false }
            ])
            expect(projection.tileBag.items).toEqual([])
            expect(Compile(projector.schema).Check(projection)).toBe(true)
        }

        expect(canonical.currentAuction?.participants).toEqual([
            { playerId: 'p1', bid: 3, passed: false },
            { playerId: 'p2', bid: 5, passed: false }
        ])
    })
})
