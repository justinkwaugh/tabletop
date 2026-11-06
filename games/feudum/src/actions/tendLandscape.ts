import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { Spaces, type SpaceId } from '../data/board.js'
import type { Landscape, LandscapeKind, TileId } from '../data/regionTiles.js'
import { ActionType } from '../definition/actions.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { RankChange } from '../model/guildStatus.js'
import {
    collectLandscape,
    fillLandscape,
    landscapeKindOf,
    landscapeOf,
    LandscapeCollection
} from '../model/landscapes.js'
import { payGoods } from '../model/payments.js'
import {
    ComponentCount,
    LandscapeKindSchema,
    SpaceIdSchema,
    TileIdSchema
} from '../model/stateSchemas.js'
import {
    CardPlayFields,
    cardOf,
    playCard,
    reasonCardPlayRefused,
    reasonSpecialRefused,
    type CardPlayInput,
    type RepeatMode
} from './cardPlay.js'

export type TendLandscapeMetadata = Type.Static<typeof TendLandscapeMetadata>
export const TendLandscapeMetadata = Type.Object({
    landscape: LandscapeKindSchema,
    /** R-4.3.4, R-1.1-H1 What the fill found in its supply. */
    filled: ComponentCount,
    vp: Type.Integer({ minimum: 0 }),
    /** R-4.3.4 Absent: left where it lay. */
    collected: Type.Optional(LandscapeCollection),
    /** R-4.5.2 A marker gained can bring a seat's guild standing. */
    rankChanges: Type.Array(RankChange)
})

export type TendLandscape = Type.Static<typeof TendLandscape>
export const TendLandscape = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.TendLandscape),
            playerId: Type.String(),
            tileId: TileIdSchema,
            spaceId: SpaceIdSchema,
            /** R-4.3.4 Collect at once, or leave the fill lying. */
            collect: Type.Boolean(),
            metadata: Type.Optional(TendLandscapeMetadata)
        })
    ])
)

export const TendLandscapeValidator = Compile(TendLandscape)

export function isTendLandscape(action?: GameAction): action is TendLandscape {
    return action?.type === ActionType.TendLandscape
}

function isOpenToTend(state: HydratedFeudumGameState, playerId: string, spaceId: SpaceId): boolean {
    const space = state.spaces[spaceId]
    return space.serf?.playerId === playerId && !space.landscape
}

export interface TendInput extends CardPlayInput {
    readonly tileId: TileId
    readonly spaceId: SpaceId
}

/** R-3.9.3, R-3.4 A wood, a tile collected, a space where the seat is serf and no landscape lies. */
export function reasonTendLandscapeRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: TendInput
): string | undefined {
    const refused =
        reasonCardPlayRefused(state, playerId, 'improve', input) ??
        reasonSpecialRefused(state, playerId, 'improve')
    if (refused) {
        return refused
    }
    if (!state.getPlayerState(playerId).regionTiles.includes(input.tileId)) {
        return "You haven't collected that tile."
    }
    const space = state.spaces[input.spaceId]
    if (space.serf?.playerId !== playerId) {
        return "You aren't the serf there."
    }
    return space.landscape ? 'That location already has a landscape.' : undefined
}

export interface TendTileOffer {
    readonly tileId: TileId
    readonly landscape: LandscapeKind
    readonly resource: Landscape['resource']
}

export interface TendLandscapeOffers {
    readonly tiles: readonly TendTileOffer[]
    readonly spaceIds: readonly SpaceId[]
}

/** R-3.9.3 The seat's collected tiles, and the spaces one could be placed on. */
export function tendLandscapeOffers(
    state: HydratedFeudumGameState,
    playerId: string
): TendLandscapeOffers {
    return {
        tiles: state.getPlayerState(playerId).regionTiles.map((tileId) => ({
            tileId,
            landscape: landscapeKindOf(state, tileId),
            resource: landscapeOf(state, tileId).resource
        })),
        spaceIds: Spaces.map(({ id }) => id).filter((id) => isOpenToTend(state, playerId, id))
    }
}

export interface TendLandscapePreview {
    readonly filled: number
    readonly collected: LandscapeCollection
}

/** R-4.3.4 The fill and the split if collected, run on a copy. */
export function tendLandscapePreview(
    state: HydratedFeudumGameState,
    tileId: TileId,
    spaceId: SpaceId
): TendLandscapePreview {
    const copy = new HydratedFeudumGameState(state.dehydrate())
    copy.spaces[spaceId].landscape = { tileId, amount: 0 }
    const filled = fillLandscape(copy, spaceId)
    return { filled, collected: collectLandscape(copy, spaceId) }
}

/** R-3.9.3 What the card prints for its special. */
function tendVp(): number {
    const { vp } = cardOf('improve').special
    assertExists(vp, 'R-3.9.3 Tend Landscape prints its vp')
    return vp
}

export class HydratedTendLandscape
    extends HydratableAction<typeof TendLandscape>
    implements TendLandscape
{
    declare type: ActionType.TendLandscape
    declare playerId: string
    declare tileId: TileId
    declare spaceId: SpaceId
    declare collect: boolean
    declare metadata?: TendLandscapeMetadata
    declare asRepeat?: RepeatMode
    declare secondCard?: true

    constructor(data: TendLandscape) {
        super(data, TendLandscapeValidator)
    }

    /** R-3.9.3, R-4.3.4 */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonTendLandscapeRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        playCard(state, this.playerId, 'improve', 'special', this)
        payGoods(state, this.playerId, { wood: 1 })

        const player = state.getPlayerState(this.playerId)
        player.regionTiles = player.regionTiles.filter((tileId) => tileId !== this.tileId)
        state.spaces[this.spaceId].landscape = { tileId: this.tileId, amount: 0 }

        const vp = tendVp()
        player.score += vp
        const filled = fillLandscape(state, this.spaceId)
        const collected = this.collect ? collectLandscape(state, this.spaceId) : undefined

        this.metadata = {
            landscape: landscapeKindOf(state, this.tileId),
            filled,
            vp,
            ...(collected ? { collected } : {}),
            rankChanges: state.recomputeRanks(this.playerId)
        }
    }
}
