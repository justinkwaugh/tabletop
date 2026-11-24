import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { Regions, Spaces, type SpaceId } from '../data/board.js'
import { GuildIds } from '../data/components.js'
import { GuildRanks, GuildTrackSpaces } from '../data/guilds.js'
import { LandscapeDawnVp, RegionIds } from '../data/regionTiles.js'
import type { Epoch } from '../data/tracks.js'
import { activeRegionIds, activeRegionVp, disloyaltyVp } from './activeRegions.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { rankOf } from './guildStatus.js'
import { drawGood } from './haversack.js'
import { fillLandscape, landscapeKindOf, tendedLandscapes } from './landscapes.js'
import { landscapeTender } from './locationControl.js'
import {
    ComponentCount,
    GoodSchema,
    GuildIdSchema,
    LandscapeKindSchema,
    SpaceIdSchema
} from './stateSchemas.js'
import { sunray } from './tracks.js'

/** R-4.12 */
export type DawnSheetRow = Type.Static<typeof DawnSheetRow>
export const DawnSheetRow = Type.Object({
    playerId: Type.String(),
    /** R-4.12.1 Each guild where the seat holds a rank. */
    ranks: Type.Array(
        Type.Object({
            guild: GuildIdSchema,
            rank: Type.Enum(GuildRanks),
            vp: ComponentCount
        })
    ),
    /** R-4.12.1 The landscapes the seat's serfs tend, as they lay before the fill. */
    landscapes: Type.Object({
        empty: ComponentCount,
        filled: ComponentCount,
        vp: ComponentCount
    }),
    /** R-4.12.1 */
    activeRegions: Type.Object({
        regions: Type.Array(Type.Enum(RegionIds)),
        vp: ComponentCount
    }),
    /** R-4.9.2 Negative, or 0. */
    disloyaltyVp: Type.Integer({ maximum: 0 }),
    total: Type.Integer()
})

/** R-4.12.3 One landscape's fill; `added` is what the supply had, up to 3. */
export type LandscapeFilled = Type.Static<typeof LandscapeFilled>
export const LandscapeFilled = Type.Object({
    spaceId: SpaceIdSchema,
    landscape: LandscapeKindSchema,
    added: ComponentCount
})

/** R-4.12.4 One good beside its region's space. */
export type MapGood = Type.Static<typeof MapGood>
export const MapGood = Type.Object({ spaceId: SpaceIdSchema, good: GoodSchema })

/** R-4.12.1 */
function rankRows(state: HydratedFeudumGameState, playerId: string): DawnSheetRow['ranks'] {
    return GuildIds.flatMap((guild) => {
        const rank = rankOf(state.guilds.tracks[guild], playerId)
        if (!rank) {
            return []
        }
        const row = GuildTrackSpaces.find((space) => space.guild === guild && space.rank === rank)
        assertExists(row, `R-1.3 ${guild} has a ${rank} space`)
        return [{ guild, rank, vp: row.dawnVp }]
    })
}

/** R-4.12.1 2 vp empty, 4 vp with any resource on it. An untended landscape scores nobody. */
function landscapeRow(
    state: HydratedFeudumGameState,
    playerId: string
): DawnSheetRow['landscapes'] {
    const tended = Spaces.filter(({ id }) => landscapeTender(state.spaces[id]) === playerId)
    const filled = tended.filter(({ id }) => (state.spaces[id].landscape?.amount ?? 0) > 0).length
    const empty = tended.length - filled
    return { empty, filled, vp: empty * LandscapeDawnVp.empty + filled * LandscapeDawnVp.filled }
}

/** R-4.12.1, R-4.12.2 Scores the seat's row and returns it. Read before the landscapes fill. */
function scoreDawnRow(
    state: HydratedFeudumGameState,
    playerId: string,
    epoch: Epoch
): DawnSheetRow {
    const ranks = rankRows(state, playerId)
    const landscapes = landscapeRow(state, playerId)
    const activeRegions = {
        regions: activeRegionIds(state, playerId),
        vp: activeRegionVp(state, playerId)
    }
    const disloyalty = disloyaltyVp(state, playerId, epoch)
    const total =
        ranks.reduce((sum, row) => sum + row.vp, 0) + landscapes.vp + activeRegions.vp + disloyalty
    state.getPlayerState(playerId).score += total
    return { playerId, ranks, landscapes, activeRegions, disloyaltyVp: disloyalty, total }
}

/** R-4.12.1, R-4.12.2 */
export function scoreDawn(state: HydratedFeudumGameState, epoch: Epoch): DawnSheetRow[] {
    return state.turnManager.turnOrder.map((playerId) => scoreDawnRow(state, playerId, epoch))
}

/** R-4.12-H1 Seat by seat in turn order, then the landscapes no serf tends. */
function fillOrder(state: HydratedFeudumGameState): SpaceId[] {
    const landscapes = Spaces.map(({ id }) => id).filter((id) => state.spaces[id].landscape)
    return [
        ...state.turnManager.turnOrder.flatMap((playerId) =>
            landscapes.filter((id) => landscapeTender(state.spaces[id]) === playerId)
        ),
        ...landscapes.filter((id) => landscapeTender(state.spaces[id]) === undefined)
    ]
}

/** R-4.12.3, R-4.3.4, R-1.1-H1 Every landscape gains 3 of its resource, or what remains of it. */
export function fillLandscapes(state: HydratedFeudumGameState): LandscapeFilled[] {
    return fillOrder(state).map((spaceId) => {
        const { landscape } = state.spaces[spaceId]
        assertExists(landscape, `R-4.3.4 ${spaceId} has a landscape`)
        return {
            spaceId,
            landscape: landscapeKindOf(state, landscape.tileId),
            added: fillLandscape(state, spaceId)
        }
    })
}

/** R-4.12.3 The serfs now holding a filled landscape, in turn order. */
export function serfsWithFilledLandscapes(state: HydratedFeudumGameState): string[] {
    return state.turnManager.turnOrder.filter(
        (playerId) => tendedLandscapes(state, playerId).length > 0
    )
}

/** R-4.12.4, R-5.2, R-1.1-H1 */
export function replenishMap(state: HydratedFeudumGameState): MapGood[] {
    const { mapDirection } = sunray(state.epoch)
    return Regions.flatMap(({ region, spaces }) => {
        const space = spaces.find(({ letters }) => mapDirection && letters.includes(mapDirection))
        assertExists(space, `R-1.2.1 ${region} has a ${mapDirection} space`)
        const good = drawGood(state)
        if (!good) {
            return []
        }
        state.spaces[space.id].goods[good] += 1
        return [{ spaceId: space.id, good }]
    })
}
