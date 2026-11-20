import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { Spaces, type SpaceId } from '../data/board.js'
import { Goods, GuildIds, type Good, type GuildId } from '../data/components.js'
import type { DiscId, LocationKind } from '../data/discs.js'
import { GuildById } from '../data/guilds.js'
import { RegionIds, type RegionId, type TileId } from '../data/regionTiles.js'
import { ActionType } from '../definition/actions.js'
import { markRevealsInfo } from '../definition/revealing.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { RankChange } from '../model/guildStatus.js'
import {
    type DiscChoice,
    discChoices,
    locationKindOf,
    replaceLocationDisc
} from '../model/locationDiscs.js'
import { canCoverWithWildTiles, payGoods } from '../model/payments.js'
import {
    collectTopTile,
    improvementTile,
    stackTop,
    tileVp,
    type StackTile
} from '../model/regionStacks.js'
import { moveConcealedSeal } from '../model/seals.js'
import {
    ComponentCount,
    DiscIdSchema,
    GoodCounts,
    GuildIdSchema,
    LandscapeKindSchema,
    SpaceIdSchema,
    TileIdSchema
} from '../model/stateSchemas.js'
import { returnGoodToHaversack } from '../model/supply.js'
import {
    CardPlayFields,
    playCard,
    reasonCardPlayRefused,
    type CardPlayInput,
    type RepeatMode
} from './cardPlay.js'

const LocationKindSchema = Type.Union([
    Type.Literal('outpost'),
    Type.Literal('farm'),
    Type.Literal('town'),
    Type.Literal('feudum')
])

export type ImproveMetadata = Type.Static<typeof ImproveMetadata>
export const ImproveMetadata = Type.Object({
    from: LocationKindSchema,
    to: LocationKindSchema,
    /** R-3.9-H1 The disc taken, chosen or the lowest. */
    discId: DiscIdSchema,
    /** R-3.9.1 A farm's goods, on becoming a town. */
    goodsToHaversack: Type.Optional(GoodCounts),
    /** R-4.3.2 Absent: a prohibited tile, and no stack to fall back on. */
    tile: Type.Optional(
        Type.Object({
            tileId: TileIdSchema,
            landscape: LandscapeKindSchema,
            /** R-4.3-H1 0 on a fallback. */
            vp: ComponentCount
        })
    ),
    /** R-4.3.1, R-4.3.2 Absent when a tile was taken. */
    noTile: Type.Optional(Type.Union([Type.Literal('empty'), Type.Literal('prohibited')])),
    rankChanges: Type.Array(RankChange)
})

export type Improve = Type.Static<typeof Improve>
export const Improve = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.Improve),
            playerId: Type.String(),
            spaceId: SpaceIdSchema,
            /** R-3.9.1 Only to a feudum. */
            feudumGuild: Type.Optional(GuildIdSchema),
            /** R-3.9-H1 Only when the candidates differ in their other face. */
            discId: Type.Optional(DiscIdSchema),
            /** R-4.3-H1 Only when the tile is prohibited and another stack has an earlier top. */
            fallbackRegion: Type.Optional(Type.Enum(RegionIds)),
            metadata: Type.Optional(ImproveMetadata)
        })
    ])
)

export const ImproveValidator = Compile(Improve)

export function isImprove(action?: GameAction): action is Improve {
    return action?.type === ActionType.Improve
}

type ImprovementCost = Good | 'seal'

interface ImproveStep {
    readonly to: Exclude<LocationKind, 'outpost'>
    readonly cost: ImprovementCost
    readonly unmet: string
}

/** R-3.9.1 */
const ImproveSteps: Readonly<Record<Exclude<LocationKind, 'feudum'>, ImproveStep>> = {
    outpost: { to: 'farm', cost: 'wood', unmet: 'Improving an outpost to a farm needs a wood.' },
    farm: { to: 'town', cost: 'iron', unmet: 'Improving a farm to a town needs an iron.' },
    town: { to: 'feudum', cost: 'seal', unmet: "Improving a town to a feudum needs a king's seal." }
}

function stepFrom(kind: LocationKind): ImproveStep | undefined {
    return kind === 'feudum' ? undefined : ImproveSteps[kind]
}

function canPay(state: HydratedFeudumGameState, playerId: string, cost: ImprovementCost): boolean {
    const player = state.getPlayerState(playerId)
    return cost === 'seal' ? player.sealCount > 0 : player.goods[cost] > 0
}

function regionOf(spaceId: SpaceId): RegionId {
    const space = Spaces.find(({ id }) => id === spaceId)
    assertExists(space, `R-1.4 There is a space ${spaceId}`)
    return space.region
}

export interface ImproveInput extends CardPlayInput {
    readonly spaceId: SpaceId
    readonly feudumGuild?: GuildId
    readonly discId?: DiscId
    readonly fallbackRegion?: RegionId
}

/** R-3.9.1, R-3.9-H1 */
function reasonDiscRefused(
    state: HydratedFeudumGameState,
    step: ImproveStep,
    input: ImproveInput
): string | undefined {
    if (step.to === 'feudum' && !input.feudumGuild) {
        return 'Choose a guild for the feudum.'
    }
    if (step.to !== 'feudum' && input.feudumGuild) {
        return 'Only a feudum takes a guild.'
    }
    const choices = discChoices(state, step.to, input.feudumGuild)
    if (choices.length === 0) {
        return input.feudumGuild
            ? `No ${GuildById[input.feudumGuild].name} feudum remains.`
            : `No ${step.to} disc remains.`
    }
    if (choices.length === 1) {
        return input.discId ? 'There is no choice of disc here.' : undefined
    }
    if (!input.discId) {
        return 'Choose which disc to take.'
    }
    return choices.some((choice) => choice.discId === input.discId)
        ? undefined
        : 'That disc is not on offer.'
}

/** R-4.3.2, R-4.3-H1 */
function reasonFallbackRefused(
    state: HydratedFeudumGameState,
    region: RegionId,
    fallbackRegion: RegionId | undefined
): string | undefined {
    const tile = improvementTile(state, region)
    if (tile.kind === 'legal') {
        return fallbackRegion ? 'The tile is legal: there is no stack to choose.' : undefined
    }
    if (tile.candidates.length === 0) {
        return fallbackRegion ? 'There is no earlier tile to take.' : undefined
    }
    if (!fallbackRegion) {
        return 'Choose a stack to take an earlier tile from.'
    }
    return tile.candidates.some(({ stack }) => stack === fallbackRegion)
        ? undefined
        : 'That stack has no earlier tile to take.'
}

/** R-3.9.1, R-3.9-H1, R-3.9-H2, R-4.3.2, R-4.3-H1 */
export function reasonImproveRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: ImproveInput
): string | undefined {
    const refused = reasonCardPlayRefused(state, playerId, 'improve', input)
    if (refused) {
        return refused
    }
    const space = state.spaces[input.spaceId]
    if (space.ruler?.playerId !== playerId) {
        return "You don't rule that location."
    }
    const step = stepFrom(locationKindOf(space.location))
    if (!step) {
        return 'A feudum cannot be improved.'
    }
    if (!canPay(state, playerId, step.cost)) {
        return step.unmet
    }
    return (
        reasonDiscRefused(state, step, input) ??
        reasonFallbackRefused(state, regionOf(input.spaceId), input.fallbackRegion)
    )
}

export type ImproveTileOffer =
    | { readonly kind: 'legal'; readonly tileId: TileId; readonly vp: number }
    | { readonly kind: 'prohibited'; readonly candidates: readonly StackTile[] }

export interface ImproveOffer {
    readonly spaceId: SpaceId
    readonly from: LocationKind
    readonly to: LocationKind
    readonly cost: ImprovementCost
    /** R-3.9.1 To a feudum: the guilds with a disc left. */
    readonly feudumGuilds: readonly GuildId[]
    /** R-3.9-H1 A choice when more than one. */
    readonly discs: readonly DiscChoice[]
    readonly tile: ImproveTileOffer
    /** R-X.2 Whether it takes a tile, so a stack's next face shows. */
    readonly revealsInfo: boolean
}

/** R-3.9.1 The locations the seat can improve now, and what each would take and bring. */
export function improveOffers(state: HydratedFeudumGameState, playerId: string): ImproveOffer[] {
    return state.ruledSpaceIds(playerId).flatMap((spaceId): ImproveOffer[] => {
        const from = locationKindOf(state.spaces[spaceId].location)
        const step = stepFrom(from)
        if (!step || !canPay(state, playerId, step.cost)) {
            return []
        }
        const toFeudum = step.to === 'feudum'
        const feudumGuilds = toFeudum
            ? GuildIds.filter((guild) => discChoices(state, 'feudum', guild).length > 0)
            : []
        const discs = toFeudum ? [] : discChoices(state, step.to)
        if (toFeudum ? feudumGuilds.length === 0 : discs.length === 0) {
            return []
        }
        const tile = improvementTile(state, regionOf(spaceId))
        return [
            {
                spaceId,
                from,
                to: step.to,
                cost: step.cost,
                feudumGuilds,
                discs,
                tile:
                    tile.kind === 'legal'
                        ? {
                              kind: 'legal',
                              tileId: tile.tile.id,
                              vp: tileVp(tile.tile, step.to)
                          }
                        : { kind: 'prohibited', candidates: tile.candidates },
                revealsInfo: tile.kind === 'legal' || tile.candidates.length > 0
            }
        ]
    })
}

/** R-4.3-H3 Improve takes no tile, so the seat spends one at will first. */
export function improveShortSpaces(state: HydratedFeudumGameState, playerId: string): SpaceId[] {
    return state.ruledSpaceIds(playerId).filter((spaceId) => {
        const step = stepFrom(locationKindOf(state.spaces[spaceId].location))
        return (
            step !== undefined &&
            step.cost !== 'seal' &&
            !canPay(state, playerId, step.cost) &&
            canCoverWithWildTiles(state, playerId, { [step.cost]: 1 })
        )
    })
}

export class HydratedImprove extends HydratableAction<typeof Improve> implements Improve {
    declare type: ActionType.Improve
    declare playerId: string
    declare spaceId: SpaceId
    declare feudumGuild?: GuildId
    declare discId?: DiscId
    declare fallbackRegion?: RegionId
    declare metadata?: ImproveMetadata
    declare asRepeat?: RepeatMode
    declare secondCard?: true

    constructor(data: Improve) {
        super(data, ImproveValidator)
    }

    /** R-3.9.1, R-4.3.2 R-4.11-H1: an epoch condition met here waits for step 4. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonImproveRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        const { location } = state.spaces[this.spaceId]
        const from = locationKindOf(location)
        const step = stepFrom(from)
        assertExists(step, 'R-3.9.1 A feudum cannot be improved')
        playCard(state, this.playerId, 'improve', 'regular', this)

        if (step.cost === 'seal') {
            moveConcealedSeal(state, { kind: 'held', playerId: this.playerId }, { kind: 'pile' })
        } else {
            payGoods(state, this.playerId, { [step.cost]: 1 })
        }
        const goodsToHaversack =
            step.to === 'town'
                ? HydratedImprove.sendGoodsToHaversack(state, this.spaceId)
                : undefined

        const discId = this.discId ?? discChoices(state, step.to, this.feudumGuild)[0].discId
        replaceLocationDisc(state, this.spaceId, discId, step.to, this.feudumGuild)

        const tile = this.takeTile(state, step.to)

        this.metadata = {
            from,
            to: step.to,
            discId,
            ...(goodsToHaversack ? { goodsToHaversack } : {}),
            ...(tile ? { tile } : { noTile: this.noTileReason(state) }),
            rankChanges: state.recomputeRanks(this.playerId)
        }
    }

    /** R-4.3.1, R-4.3.2 With no tile taken: is the region's stack empty, or its top not yet legal? */
    private noTileReason(state: HydratedFeudumGameState): 'empty' | 'prohibited' {
        return stackTop(state, regionOf(this.spaceId)) ? 'prohibited' : 'empty'
    }

    /** R-3.9.2, R-4.3.2, R-4.3-H1 The chart's vp for a legal tile, by what the location becomes; none for a fallback. R-X.2 A taken tile shows its hidden landscape. */
    private takeTile(state: HydratedFeudumGameState, to: ImproveStep['to']) {
        const region = regionOf(this.spaceId)
        const shown = improvementTile(state, region)
        if (shown.kind === 'legal') {
            markRevealsInfo(this, true)
            const { tile, landscape } = collectTopTile(state, this.playerId, region)
            const vp = tileVp(tile, to)
            state.getPlayerState(this.playerId).score += vp
            return { tileId: tile.id, landscape, vp }
        }
        const fallback = shown.candidates.find(({ stack }) => stack === this.fallbackRegion)
        if (!fallback) {
            return undefined
        }
        markRevealsInfo(this, true)
        const { tile, landscape } = collectTopTile(state, this.playerId, fallback.stack)
        return { tileId: tile.id, landscape, vp: 0 }
    }

    /** R-3.9.1 The farm's goods go to the haversack; otherwise a location's goods stay. */
    private static sendGoodsToHaversack(
        state: HydratedFeudumGameState,
        spaceId: SpaceId
    ): GoodCounts {
        const { goods } = state.spaces[spaceId]
        const sent = { ...goods }
        for (const good of Goods) {
            returnGoodToHaversack(state, good, goods[good])
            goods[good] = 0
        }
        return sent
    }
}
