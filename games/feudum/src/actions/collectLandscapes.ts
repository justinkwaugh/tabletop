import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import type { Landscape, LandscapeKind } from '../data/regionTiles.js'
import { ActionType } from '../definition/actions.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { RankChange } from '../model/guildStatus.js'
import {
    collectLandscape,
    LandscapeCollection,
    landscapeKindOf,
    landscapeOf,
    sulfurKeptAt,
    tendedLandscapes
} from '../model/landscapes.js'
import { landscapeTender } from '../model/locationControl.js'
import { LandscapeKindSchema, SpaceIdSchema, SulfurToBarrelCount } from '../model/stateSchemas.js'
import { barrelRoom, putSulfurInBarrel, reasonSulfurCountToBarrelRefused } from '../model/supply.js'

/** R-4.3.4 One landscape collected. */
export type CollectedLandscape = Type.Static<typeof CollectedLandscape>
export const CollectedLandscape = Type.Object({
    spaceId: SpaceIdSchema,
    landscape: LandscapeKindSchema,
    collected: LandscapeCollection
})

export type CollectLandscapesMetadata = Type.Static<typeof CollectLandscapesMetadata>
export const CollectLandscapesMetadata = Type.Object({
    /** R-4.3.4 In the order named. */
    collections: Type.Array(CollectedLandscape),
    /** R-4.5.2 A marker gained can bring a seat's guild standing. */
    rankChanges: Type.Array(RankChange)
})

export type CollectLandscapes = Type.Static<typeof CollectLandscapes>
export const CollectLandscapes = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CollectLandscapes),
            playerId: Type.String(),
            /** R-4.12.3 Those collected; the rest stay, and none is a seat's "leave all". */
            spaceIds: Type.Array(SpaceIdSchema),
            /** R-4.10.2 Of the sulfur these bring the serf, how many go in the barrel. */
            sulfurToBarrel: Type.Optional(SulfurToBarrelCount),
            metadata: Type.Optional(CollectLandscapesMetadata)
        })
    ])
)

export const CollectLandscapesValidator = Compile(CollectLandscapes)

export function isCollectLandscapes(action?: GameAction): action is CollectLandscapes {
    return action?.type === ActionType.CollectLandscapes
}

export interface CollectLandscapesInput {
    readonly spaceIds: readonly SpaceId[]
    readonly sulfurToBarrel?: number
}

/** R-4.3.4, R-4.12.3, R-4.10.2 The asked serf's own tended landscapes, each with resources. */
export function reasonCollectLandscapesRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    { spaceIds, sulfurToBarrel }: CollectLandscapesInput
): string | undefined {
    if (state.flow.landscapes?.pending[0] !== playerId) {
        return "It isn't your turn to collect."
    }
    if (new Set(spaceIds).size !== spaceIds.length) {
        return 'Name each landscape once.'
    }
    for (const spaceId of spaceIds) {
        const space = state.spaces[spaceId]
        if (landscapeTender(space) !== playerId) {
            return "You don't tend a landscape there."
        }
        if (space.landscape?.amount === 0) {
            return 'That landscape holds nothing.'
        }
    }
    const gained = spaceIds.reduce((sum, spaceId) => sum + sulfurKeptAt(state, spaceId), 0)
    return reasonSulfurCountToBarrelRefused(state, playerId, gained, sulfurToBarrel)
}

/** R-4.3.4 One landscape the asked serf could collect. */
export interface CollectLandscapeSpaceOffer {
    readonly spaceId: SpaceId
    readonly landscape: LandscapeKind
    readonly resource: Landscape['resource']
    readonly amount: number
    /** R-4.3.4 The split if this one alone is collected, run on a copy. */
    readonly collected: LandscapeCollection
}

export interface CollectLandscapesOffer {
    readonly spaces: readonly CollectLandscapeSpaceOffer[]
    /** R-4.10.2 How many sulfur collected could go in the barrel, if all were. */
    readonly sulfurToBarrel: number
}

/** R-4.3.4 Collects one landscape. */
function collectOne(state: HydratedFeudumGameState, spaceId: SpaceId): CollectedLandscape {
    const { landscape } = state.spaces[spaceId]
    assertExists(landscape, `R-4.3.4 ${spaceId} has a landscape`)
    return {
        spaceId,
        landscape: landscapeKindOf(state, landscape.tileId),
        collected: collectLandscape(state, spaceId)
    }
}

/** R-4.3.4, R-4.12.3 The tended landscapes with resources, for the asked serf alone. Read-only. */
export function collectLandscapesOffer(
    state: HydratedFeudumGameState,
    playerId: string
): CollectLandscapesOffer | undefined {
    if (state.flow.landscapes?.pending[0] !== playerId) {
        return undefined
    }
    const spaceIds = tendedLandscapes(state, playerId)
    const gained = spaceIds.reduce((sum, spaceId) => sum + sulfurKeptAt(state, spaceId), 0)
    return {
        spaces: spaceIds.map((spaceId) => {
            const { landscape } = state.spaces[spaceId]
            assertExists(landscape, `R-4.3.4 ${spaceId} has a landscape`)
            return {
                ...collectOne(new HydratedFeudumGameState(state.dehydrate()), spaceId),
                resource: landscapeOf(state, landscape.tileId).resource,
                amount: landscape.amount
            }
        }),
        sulfurToBarrel: Math.min(gained, barrelRoom(state, playerId))
    }
}

export interface CollectLandscapesPreview {
    readonly collections: readonly CollectedLandscape[]
    readonly refused?: string
}

/** R-4.3.4 These picks together, run on a copy, so markers running short show. Staged input refuses. */
export function collectLandscapesPreview(
    state: HydratedFeudumGameState,
    playerId: string,
    input: CollectLandscapesInput
): CollectLandscapesPreview {
    const refused = reasonCollectLandscapesRefused(state, playerId, input)
    if (refused) {
        return { collections: [], refused }
    }
    const copy = new HydratedFeudumGameState(state.dehydrate())
    return { collections: input.spaceIds.map((spaceId) => collectOne(copy, spaceId)) }
}

export class HydratedCollectLandscapes
    extends HydratableAction<typeof CollectLandscapes>
    implements CollectLandscapes
{
    declare type: ActionType.CollectLandscapes
    declare playerId: string
    declare spaceIds: SpaceId[]
    declare sulfurToBarrel?: number
    declare metadata?: CollectLandscapesMetadata

    constructor(data: CollectLandscapes) {
        super(data, CollectLandscapesValidator)
    }

    /** R-4.3.4, R-4.12.3 Public resources: never a barrier. Then the next serf is asked. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonCollectLandscapesRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        const collections = this.spaceIds.map((spaceId) => collectOne(state, spaceId))
        if (this.sulfurToBarrel) {
            putSulfurInBarrel(state, this.playerId, this.sulfurToBarrel)
        }
        this.metadata = { collections, rankChanges: state.recomputeRanks(this.playerId) }

        const { landscapes } = state.flow
        assertExists(landscapes, 'R-4.12.3 The serfs are being asked')
        landscapes.pending.shift()
        if (landscapes.pending.length === 0) {
            state.flow.landscapes = undefined
        }
    }
}
