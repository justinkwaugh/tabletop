import { assertExists } from '@tabletop/common'
import {
    EpicVoyageTrack,
    MilitaryServiceTrack,
    type EpicVoyageSpace,
    type MilitaryServiceSpace,
    type MilitarySpaceId,
    type VoyageSpaceId
} from '../data/tracks.js'

interface TrackDiscs {
    readonly voyageTrack: Readonly<Record<string, VoyageSpaceId>>
    readonly militaryService: Readonly<Record<string, MilitarySpaceId>>
}

/** R-3.7.5 */
export function voyageSpace(spaceId: VoyageSpaceId): EpicVoyageSpace {
    const space = EpicVoyageTrack.find(({ id }) => id === spaceId)
    assertExists(space, `No voyage space ${spaceId}`)
    return space
}

/** R-4.9.1 */
export function militarySpace(spaceId: MilitarySpaceId): MilitaryServiceSpace {
    const space = MilitaryServiceTrack.find(({ id }) => id === spaceId)
    assertExists(space, `No military service space ${spaceId}`)
    return space
}

/** R-3.7.5, R-4.9.1 */
export function printedSpaceNumber(spaceId: VoyageSpaceId | MilitarySpaceId): number {
    const space = [...EpicVoyageTrack, ...MilitaryServiceTrack].find(({ id }) => id === spaceId)
    assertExists(space, `No track space ${spaceId}`)
    return space.space
}

/** R-3.7.5 None before the seat sets out. */
export function voyageSpaceOf(state: TrackDiscs, playerId: string): EpicVoyageSpace | undefined {
    const spaceId = state.voyageTrack[playerId]
    return spaceId === undefined ? undefined : voyageSpace(spaceId)
}

/** R-3.7.5 The space the seat's disc would take; none past the monastery. */
export function nextVoyageSpace(state: TrackDiscs, playerId: string): EpicVoyageSpace | undefined {
    const on = voyageSpaceOf(state, playerId)
    return EpicVoyageTrack[on ? EpicVoyageTrack.indexOf(on) + 1 : 0]
}

/** R-4.9-H2 Spaces are covered in order, so the furthest names them all. */
export function coveredServiceSpaces(
    state: TrackDiscs,
    playerId: string
): readonly MilitaryServiceSpace[] {
    const spaceId = state.militaryService[playerId]
    return spaceId === undefined
        ? []
        : MilitaryServiceTrack.slice(0, MilitaryServiceTrack.indexOf(militarySpace(spaceId)) + 1)
}

/** R-4.9.1, R-4.9-H2 None when all are covered. */
export function nextMilitarySpace(
    state: TrackDiscs,
    playerId: string
): MilitaryServiceSpace | undefined {
    return MilitaryServiceTrack[coveredServiceSpaces(state, playerId).length]
}
