import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    HydratedEighteenXXState,
    extendEighteenXXState,
    type EighteenXXState,
    type EighteenXXStateDefinition,
    type RailwayMap,
    type TileSet,
    type TrainDepot
} from '@tabletop/18xx'

const EighteenThirtyState = extendEighteenXXState({
    // Set at setup when the game allows several brown-zone shares from the IPO in one turn.
    multipleBrownFromIpo: Type.Optional(Type.Literal(true))
})
const Validator = Compile(EighteenThirtyState)

export class HydratedEighteenThirtyState extends HydratedEighteenXXState {
    declare multipleBrownFromIpo?: true
    constructor(data: EighteenXXState, map: RailwayMap, tileSet: TileSet, depot: TrainDepot) {
        super(data, map, tileSet, depot, Validator)
    }
}

export const EighteenThirtyStateDefinition: EighteenXXStateDefinition = {
    schema: EighteenThirtyState,
    hydrate: (data, map, tileSet, depot) =>
        new HydratedEighteenThirtyState(data, map, tileSet, depot)
}
