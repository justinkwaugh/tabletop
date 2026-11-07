import type { Color } from '@tabletop/common'
import {
    EpicVoyageTrack,
    MilitaryServiceTrack,
    RegionTiles,
    ScoreTrack,
    writDeckCount,
    type HydratedFeudumGameState,
    type RegionId,
    type TileEpoch,
    type WritId
} from '@tabletop/feudum'

export interface ScoreOnTrack {
    readonly space: number
    /** What the disc's space can't say: the laps past 149, or a score below 0. */
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

/** A seat's disc on a track, and its place among the discs on the same space. */
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
            const reached = EpicVoyageTrack.find(
                ({ space }) => space === state.voyageTrack[playerId]
            )
            return reached ? [{ playerId, spaceId: reached.id, key: `voyage:${playerId}` }] : []
        })
    )
}

/** R-4.9-H2 A seat's discs on each military service space it has covered. */
export function serviceDiscs(state: HydratedFeudumGameState): readonly TrackDisc[] {
    return fanned(
        state.players.flatMap(({ playerId }) =>
            MilitaryServiceTrack.filter(
                ({ space }) => space <= (state.militaryService[playerId] ?? 0)
            ).map(({ id, space }) => ({
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

/** R-4.3.1 A stack's tiles by epoch: only the top's epoch and the count show on the board, but the
 * stack's epochs are public; its landscapes are not. */
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

export interface DeckView {
    readonly count: number
    /** R-4.4.2, R-4.4.4 Writs the table saw go under, still in the deck. */
    readonly seen: readonly WritId[]
    /** R-4.4.1 What only this viewer knows lies under the deck. */
    readonly knownToViewer: number
}

export function deckView(state: HydratedFeudumGameState, viewerId: string | undefined): DeckView {
    const viewer = state.players.find(({ playerId }) => playerId === viewerId)
    return {
        count: writDeckCount(state),
        seen: state.publicDeckWrits.map(({ writId }) => writId),
        knownToViewer: viewer?.deckKnowledge?.length ?? 0
    }
}

/** The seat playing a colour; a dummy row's colour has none (R-1.4-H1). */
export function seatOfColour(state: HydratedFeudumGameState, colour: Color): string | undefined {
    return state.players.find((player) => player.color === colour)?.playerId
}
