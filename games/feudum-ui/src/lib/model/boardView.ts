import type { Color } from '@tabletop/common'
import {
    coveredServiceSpaces,
    knightRows,
    RegionTiles,
    ScoreTrack,
    type HydratedFeudumGameState,
    type RegionId,
    type TileEpoch
} from '@tabletop/feudum'
import { PrintedColours } from '$lib/utils/boardGeometry.js'

export interface ScoreOnTrack {
    readonly space: number
    readonly chip?: string
}

/** R-1.2.5, R-6 The score is uncapped; the track wraps, and its lowest space holds a score under it. */
export function scoreOnTrack(score: number): ScoreOnTrack {
    if (score < ScoreTrack.lowest) {
        return { space: ScoreTrack.lowest, chip: `${score}` }
    }
    const laps = Math.floor(score / ScoreTrack.spaces)
    return {
        space: score % ScoreTrack.spaces,
        ...(laps > 0 ? { chip: `+${laps * ScoreTrack.spaces}` } : {})
    }
}

export interface SeatScore {
    readonly playerId: string
    readonly score: number
}

export interface ScoreDisc extends ScoreOnTrack {
    readonly playerId: string
    readonly score: number
    readonly index: number
    readonly count: number
}

/** R-1.2.5 Each seat's score, in turn order. */
export function seatScores(state: HydratedFeudumGameState): readonly SeatScore[] {
    const { turnOrder } = state.turnManager
    const rank = (playerId: string) => {
        const place = turnOrder.indexOf(playerId)
        return place < 0 ? turnOrder.length : place
    }
    return [...state.players]
        .sort((a, b) => rank(a.playerId) - rank(b.playerId))
        .map(({ playerId, score }) => ({ playerId, score }))
}

/** R-1.2.5 Each seat's disc on the score track, fanned with the others on its space. */
export function scoreDiscs(scores: readonly SeatScore[]): readonly ScoreDisc[] {
    const placed = scores.map((seat) => ({ ...seat, ...scoreOnTrack(seat.score) }))
    return placed.map((disc) => {
        const sharing = placed.filter(({ space }) => space === disc.space)
        return { ...disc, index: sharing.indexOf(disc), count: sharing.length }
    })
}

export interface TrackDisc {
    readonly playerId: string
    readonly spaceId: string
    readonly key: string
    readonly index: number
    readonly count: number
}

function fanned(
    discs: readonly { playerId: string; spaceId: string; key: string }[]
): readonly TrackDisc[] {
    return discs.map((disc) => {
        const sharing = discs.filter(({ spaceId }) => spaceId === disc.spaceId)
        return { ...disc, index: sharing.indexOf(disc), count: sharing.length }
    })
}

/** R-3.7.5 Each seat's voyage disc; a seat with none has not set out. */
export function voyageDiscs(state: HydratedFeudumGameState): readonly TrackDisc[] {
    return fanned(
        state.players.flatMap(({ playerId }) => {
            const reached = state.voyageTrack[playerId]
            return reached ? [{ playerId, spaceId: reached, key: `voyage:${playerId}` }] : []
        })
    )
}

/** R-4.9-H2 A seat's discs on each military service space it has covered. */
export function serviceDiscs(state: HydratedFeudumGameState): readonly TrackDisc[] {
    return fanned(
        state.players.flatMap(({ playerId }) =>
            coveredServiceSpaces(state, playerId).map(({ id, space }) => ({
                playerId,
                spaceId: id,
                key: `service:${playerId}:${space}`
            }))
        )
    )
}

export interface StackView {
    readonly region: RegionId
    readonly count: number
    /** R-4.3.1 The top tile's epoch is public; absent, the printed V shows. */
    readonly topEpoch?: TileEpoch
}

export function stackView(state: HydratedFeudumGameState, region: RegionId): StackView {
    const stack = state.regionStacks[region]
    const top = RegionTiles.find(({ id }) => id === stack[0])
    return { region, count: stack.length, ...(top ? { topEpoch: top.epoch } : {}) }
}

/** R-4.3.1 A stack's epochs are public; its landscapes are not. */
export function stackTilesByEpoch(
    state: HydratedFeudumGameState,
    region: RegionId
): readonly { readonly epoch: TileEpoch; readonly count: number }[] {
    const epochs = state.regionStacks[region].flatMap(
        (tileId) => RegionTiles.find(({ id }) => id === tileId)?.epoch ?? []
    )
    return [...new Set(epochs)]
        .toSorted((a, b) => a - b)
        .map((epoch) => ({ epoch, count: epochs.filter((other) => other === epoch).length }))
}

export interface InfluencePool {
    readonly colour: Color
    readonly count: number
    readonly playerId?: string
}

/** R-1.4.2, R-1.4-H1 A dummy row's pool goes by its colour, so no colour stands for a seat. */
export function influencePools(state: HydratedFeudumGameState): InfluencePool[] {
    const pools: (InfluencePool | undefined)[] = [
        ...state.players.map(({ color, playerId }) => {
            const count = state.supply.influence[playerId]
            return count === undefined ? undefined : { colour: color, playerId, count }
        }),
        ...knightRows(state).map(({ row }) => {
            if (!('dummyColour' in row.owner)) {
                return undefined
            }
            const colour = row.owner.dummyColour
            const count = state.supply.dummyInfluence[colour]
            return count === undefined ? undefined : { colour, count }
        })
    ]
    return pools
        .filter((pool): pool is InfluencePool => pool !== undefined)
        .sort((a, b) => PrintedColours.indexOf(a.colour) - PrintedColours.indexOf(b.colour))
}
