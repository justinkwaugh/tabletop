import {
    ActionSource,
    AuctionType,
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
import { FreshFishVisibilityPolicy } from './visibility.js'

describe('Fresh Fish visibility schemas', () => {
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

    it('keeps the canonical auction shape while declaring sealed bids', () => {
        expect(FreshFishAuctionParticipant.properties.bid[Visibility.MetadataKey]).toEqual({
            policy: FreshFishVisibilityPolicy.SealedBid,
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
            policy: FreshFishVisibilityPolicy.SealedBid,
            redaction: { kind: 'omit' }
        })
    })

    it('derives a non-executable PlaceBid projection with an optional amount', () => {
        const canonicalAction = {
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId: 'player-1',
            amount: 7
        }
        const redactedAction = {
            id: 'action-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.PlaceBid,
            playerId: 'player-1'
        }

        expect(PlaceBid.properties.amount[Visibility.MetadataKey]).toEqual({
            policy: FreshFishVisibilityPolicy.SealedBid,
            redaction: { kind: 'omit' }
        })
        expect(Compile(PlaceBid).Check(canonicalAction)).toBe(true)
        expect(Compile(PlaceBid).Check(redactedAction)).toBe(false)
        expect(Compile(PlaceBidProjection).Check(canonicalAction)).toBe(true)
        expect(Compile(PlaceBidProjection).Check(redactedAction)).toBe(true)
        expect(PlaceBid.required).toContain('amount')
        expect(PlaceBidProjection.required).not.toContain('amount')
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
})
