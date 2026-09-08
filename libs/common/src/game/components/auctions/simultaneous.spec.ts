import { Compile } from 'typebox/compile'
import * as Type from 'typebox'
import { describe, expect, it } from 'vitest'
import * as Visibility from '../../visibility/index.js'
import { AuctionType } from './auction.js'
import {
    HydratedSimultaneousAuction,
    type SimultaneousAuction,
    SimultaneousAuction as SimultaneousAuctionSchema,
    SimultaneousAuctionVisibility,
    TieResolutionStrategy
} from './simultaneous.js'

function createUnresolvedAuction(): SimultaneousAuction {
    return {
        id: 'auction-1',
        type: AuctionType.Simultaneous,
        participants: [
            { playerId: 'player-1', bid: 3, passed: false, submitted: true },
            { playerId: 'player-2', bid: 5, passed: false, submitted: true },
            { playerId: 'player-3', passed: false, submitted: false }
        ],
        auctioneerId: 'player-1',
        tie: false,
        tieResolution: TieResolutionStrategy.FirstInOrder
    }
}

describe('simultaneous auction visibility', () => {
    it('declares its scope and protected bid state in the shared schema', () => {
        const Projection = Visibility.createProjectionSchema(SimultaneousAuctionSchema)

        expect(SimultaneousAuctionSchema[Visibility.ScopeKey]).toBe(
            SimultaneousAuctionVisibility.Scope
        )
        expect(
            SimultaneousAuctionSchema.properties.participants.items.properties.bid[
                Visibility.MetadataKey
            ]
        ).toEqual({
            policy: SimultaneousAuctionVisibility.Policy.Bid,
            redaction: { kind: 'omit' }
        })
        expect(Projection[Visibility.ScopeKey]).toBe(SimultaneousAuctionVisibility.Scope)
        expect(Projection.properties.participants.items.required).toEqual(['playerId', 'passed'])
        expect(Projection.properties.participants.items.properties.submitted).toBeDefined()
    })

    it('shows unresolved bids only to their submitting Players', () => {
        const canonical = createUnresolvedAuction()
        const projector = Visibility.createProjector(SimultaneousAuctionSchema)

        expect(
            projector.project(canonical, { kind: 'player', playerId: 'player-1' }).participants
        ).toEqual([
            { playerId: 'player-1', bid: 3, passed: false, submitted: true },
            { playerId: 'player-2', passed: false, submitted: true },
            { playerId: 'player-3', passed: false, submitted: false }
        ])
        expect(
            projector.project(canonical, { kind: 'player', playerId: 'player-2' }).participants
        ).toEqual([
            { playerId: 'player-1', passed: false, submitted: true },
            { playerId: 'player-2', bid: 5, passed: false, submitted: true },
            { playerId: 'player-3', passed: false, submitted: false }
        ])
        expect(projector.project(canonical, { kind: 'spectator' }).participants).toEqual([
            { playerId: 'player-1', passed: false, submitted: true },
            { playerId: 'player-2', passed: false, submitted: true },
            { playerId: 'player-3', passed: false, submitted: false }
        ])
        expect(canonical.participants[0].bid).toBe(3)
    })

    it('shows every bid to every Perspective after the auction resolves', () => {
        const unresolved = createUnresolvedAuction()
        const resolved: SimultaneousAuction = {
            ...unresolved,
            participants: [
                { playerId: 'player-1', bid: 3, passed: false, submitted: true },
                { playerId: 'player-2', bid: 5, passed: false, submitted: true },
                { playerId: 'player-3', bid: 4, passed: false, submitted: true }
            ],
            highBid: 5,
            winnerId: 'player-2'
        }
        const projector = Visibility.createProjector(SimultaneousAuctionSchema)

        for (const perspective of [
            { kind: 'player', playerId: 'player-1' },
            { kind: 'player', playerId: 'player-3' },
            { kind: 'spectator' }
        ] satisfies Visibility.Perspective[]) {
            const projection = projector.project(resolved, perspective)
            expect(projection).toEqual(resolved)
            expect(Compile(projector.schema).Check(projection)).toBe(true)
        }
    })

    it('uses public submission status without reading another Player bid', () => {
        const auction = new HydratedSimultaneousAuction({
            id: 'auction-1',
            type: AuctionType.Simultaneous,
            participants: [
                { playerId: 'player-1', passed: false, submitted: false },
                { playerId: 'player-2', passed: false, submitted: false }
            ],
            auctioneerId: 'player-1',
            tie: false,
            tieResolution: TieResolutionStrategy.FirstInOrder
        })
        const projector = Visibility.createProjector(SimultaneousAuctionSchema)
        const projected = projector.project(auction, {
            kind: 'player',
            playerId: 'player-1'
        })
        const guarded = projector.guardForExecution(new HydratedSimultaneousAuction(projected), {
            kind: 'player',
            playerId: 'player-1'
        })

        expect(() => guarded.placeBid('player-1', 4)).not.toThrow()
        expect(guarded.participants[0]).toMatchObject({ bid: 4, submitted: true })
        expect(guarded.winnerId).toBeUndefined()
    })

    it('still resolves persisted auctions that predate public submission status', () => {
        const auction = new HydratedSimultaneousAuction({
            id: 'legacy-auction',
            type: AuctionType.Simultaneous,
            participants: [
                { playerId: 'player-1', bid: 3, passed: false },
                { playerId: 'player-2', passed: false }
            ],
            auctioneerId: 'player-1',
            tie: false,
            tieResolution: TieResolutionStrategy.FirstInOrder
        })

        auction.placeBid('player-2', 5)

        expect(auction.winnerId).toBe('player-2')
        expect(auction.highBid).toBe(5)
        expect(Compile(SimultaneousAuctionSchema).Check(auction)).toBe(true)
    })

    it('fails closed when composition removes the auction scope but retains its bid policy', () => {
        const UnscopedAuction = Type.Object({ ...SimultaneousAuctionSchema.properties })
        const projector = Visibility.createProjector(UnscopedAuction)

        expect(() =>
            projector.project(createUnresolvedAuction(), {
                kind: 'player',
                playerId: 'player-1'
            })
        ).toThrow(
            `No enclosing visibility scope found for "${SimultaneousAuctionVisibility.Scope}"`
        )
    })
})
