import * as Type from 'typebox'
import { LocationKinds } from '../data/discs.js'
import {
    ComponentCount,
    DiscIdSchema,
    GoodCounts,
    SpaceIdSchema,
    TileIdSchema,
    VesselCounts
} from './stateSchemas.js'

/** R-4.1 A feudum's guild is the disc's own (`feudumGuildOf`). */
export type LocationState = Type.Static<typeof LocationState>
export const LocationState = Type.Object({
    kind: Type.Enum(LocationKinds),
    discId: DiscIdSchema
})

/** R-4.3.4 One per space, never removed. The tile's landscape is in `tileLandscapes`. */
export type LandscapeState = Type.Static<typeof LandscapeState>
export const LandscapeState = Type.Object({
    tileId: TileIdSchema,
    amount: ComponentCount
})

/** R-4.1.2 A ruler's one or two markers; R-3.14.2 immune: a seal lies under the subject. */
export type RulerState = Type.Static<typeof RulerState>
export const RulerState = Type.Object({
    playerId: Type.String(),
    subject: Type.Boolean(),
    subjectImmune: Type.Optional(Type.Literal(true))
})

/** R-4.1.2, R-3.14.2 */
export type SerfState = Type.Static<typeof SerfState>
export const SerfState = Type.Object({
    playerId: Type.String(),
    immune: Type.Optional(Type.Literal(true))
})

/** R-4.1 A pawn stands here through its own `spaceId`, a monster through `monsters`. */
export type SpaceState = Type.Static<typeof SpaceState>
export const SpaceState = Type.Object({
    location: LocationState,
    /** R-1.4.6, R-4.12.4 Goods beside the space; R-3.11.1 on a farm, its harvest. */
    goods: GoodCounts,
    landscape: Type.Optional(LandscapeState),
    ruler: Type.Optional(RulerState),
    serf: Type.Optional(SerfState),
    /** R-4.2.2 Abandoned vessels. */
    vessels: VesselCounts
})

/** R-4.2.4 Both absent: in the Knight Guild. */
export type MonsterState = Type.Static<typeof MonsterState>
export const MonsterState = Type.Object({
    playerId: Type.Optional(Type.String()),
    spaceId: Type.Optional(SpaceIdSchema)
})
