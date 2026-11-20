import * as Type from 'typebox'
import { ComponentCount, DiscIdSchema, GoodCounts, VesselCounts } from './stateSchemas.js'

/** R-1.4.2 The general supply; goods' supply is the haversack (R-1.4.4). */
export type SupplyState = Type.Static<typeof SupplyState>
export const SupplyState = Type.Object({
    /** R-5.4-H1 The counts are public; a draw is a protected random pick. */
    haversack: GoodCounts,
    /** R-1.1-H1 */
    shillings: ComponentCount,
    /** R-1.4.2 Each seat's influence markers, by playerId. */
    influence: Type.Record(Type.String(), ComponentCount),
    /** R-1.4.2, R-1.4-H1 Each dummy Knight row's markers, by row id. */
    dummyInfluence: Type.Record(Type.String(), ComponentCount),
    vessels: VesselCounts,
    targets: ComponentCount,
    /** R-3.9.1 */
    discs: Type.Array(DiscIdSchema),
    /** R-5-H1 Order and identities are in the vault. */
    sealPileCount: ComponentCount
})
