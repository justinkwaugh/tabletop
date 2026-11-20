import { assert, assertExists } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import type { GuildId } from '../data/components.js'
import {
    LocationDiscs,
    type DiscFace,
    type DiscId,
    type LocationDisc,
    type LocationKind
} from '../data/discs.js'
import type { HydratedFeudumGameState } from './gameState.js'
import type { LocationState } from './mapState.js'

/** R-3.9.1 The face showing this location, and what the other shows; a starting disc has no other. */
interface Showing {
    readonly face: DiscFace
    readonly other?: LocationKind
}

function showing(disc: LocationDisc, kind: LocationKind): Showing | undefined {
    if (!('faces' in disc)) {
        return disc.kind === kind ? { face: 'a' } : undefined
    }
    if (disc.faces.a === kind) {
        return { face: 'a', other: disc.faces.b }
    }
    return disc.faces.b === kind ? { face: 'b', other: disc.faces.a } : undefined
}

function discsOfSupply(
    state: HydratedFeudumGameState,
    kind: LocationKind,
    guild?: GuildId
): LocationDisc[] {
    return LocationDiscs.filter(
        (disc) =>
            state.supply.discs.includes(disc.id) &&
            showing(disc, kind) !== undefined &&
            (guild === undefined || ('guild' in disc && disc.guild === guild))
    )
}

export interface DiscChoice {
    readonly discId: DiscId
    /** What its other face shows; absent on a starting disc's plain back. */
    readonly other?: LocationKind
}

/** R-3.9-H1, R-3.9-H2 The lowest id of each other face; a plain back is a face of its own. */
export function discChoices(
    state: HydratedFeudumGameState,
    kind: LocationKind,
    guild?: GuildId
): DiscChoice[] {
    const choices = new Map<LocationKind | undefined, DiscChoice>()
    for (const disc of discsOfSupply(state, kind, guild)) {
        const other = showing(disc, kind)?.other
        if (!choices.has(other)) {
            choices.set(other, { discId: disc.id, ...(other ? { other } : {}) })
        }
    }
    return [...choices.values()]
}

/** R-3.9.1, R-3.9-H2 The new disc leaves the supply and the replaced one returns to it. */
export function replaceLocationDisc(
    state: HydratedFeudumGameState,
    spaceId: SpaceId,
    discId: DiscId,
    kind: LocationKind,
    guild?: GuildId
): void {
    const disc = discsOfSupply(state, kind, guild).find((candidate) => candidate.id === discId)
    assertExists(disc, `R-3.9.1 Disc ${discId} in the supply shows ${kind}`)
    const shown = showing(disc, kind)
    assertExists(shown, `R-3.9.1 Disc ${discId} shows ${kind}`)
    const space = state.spaces[spaceId]
    state.supply.discs = [
        ...state.supply.discs.filter((id) => id !== discId),
        space.location.discId
    ]
    space.location = locationShowing(disc, shown.face)
}

/** R-3.9.1 Only a double-sided disc has a face that play chooses. */
function locationShowing(disc: LocationDisc, face: DiscFace): LocationState {
    if ('guild' in disc || !('faces' in disc)) {
        return { discId: disc.id }
    }
    return { discId: disc.id, face }
}

function locationDisc(discId: DiscId): LocationDisc {
    const disc = LocationDiscs.find((candidate) => candidate.id === discId)
    assertExists(disc, `No location disc ${discId}`)
    return disc
}

/** R-4.1, R-4.8-H2 What the location shows, read from its disc. */
export function locationKindOf(location: LocationState): LocationKind {
    const disc = locationDisc(location.discId)
    if (!('faces' in disc)) {
        return disc.kind
    }
    if ('guild' in disc) {
        return 'asOutpost' in location ? 'outpost' : 'feudum'
    }
    assert('face' in location, `R-3.9.1 ${disc.id} lies with a face up`)
    return disc.faces[location.face]
}

/** R-1.2.4, R-4.1 The guild a feudum's disc shows; no other location has one. */
export function feudumGuildOf(location: LocationState): GuildId | undefined {
    const disc = locationDisc(location.discId)
    return locationKindOf(location) === 'feudum' && 'guild' in disc ? disc.guild : undefined
}
