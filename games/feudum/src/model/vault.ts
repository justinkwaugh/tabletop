import * as Type from 'typebox'
import { ComponentCount, LandscapeKindSchema, SealIdSchema, WritIdSchema } from './stateSchemas.js'

/** R-5.1, R-5-H1, R-1.4-H2 Everything no player may know. Index 0 is the top of the seal pile. */
export type FeudumVault = Type.Static<typeof FeudumVault>
export const FeudumVault = Type.Object({
    /** R-5.1 By slot; a draw takes the lowest. */
    writDeck: Type.Array(Type.Object({ slot: ComponentCount, writId: WritIdSchema })),
    /** R-5-H1 */
    sealPile: Type.Array(SealIdSchema),
    /** R-5-H1 By scroll space: an entry for each one public state shows occupied. */
    scrollSeals: Type.Record(Type.String(), SealIdSchema),
    /** R-5-H1 By playerId. */
    heldSeals: Type.Record(Type.String(), Type.Array(SealIdSchema)),
    /** R-4.4.3 By playerId: the seals on sealed charters. */
    charterSeals: Type.Record(Type.String(), Type.Array(SealIdSchema)),
    /** R-3.14.2 Keyed by space and role. */
    immunitySeals: Type.Record(Type.String(), SealIdSchema),
    /** R-1.4-H2 The landscape of each tile still in a stack, by tile id. */
    tileLandscapes: Type.Record(Type.String(), LandscapeKindSchema)
})
