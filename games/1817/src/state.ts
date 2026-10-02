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

const EighteenSeventeenState = extendEighteenXXState({
    // The bank's remaining subsidy toward privates sold below face value in the opening auction;
    // positions prepared after the opening have none.
    seedMoney: Type.Optional(Type.Integer({ minimum: 0 }))
})
const Validator = Compile(EighteenSeventeenState)

export class HydratedEighteenSeventeenState extends HydratedEighteenXXState {
    declare seedMoney?: number
    constructor(data: EighteenXXState, map: RailwayMap, tileSet: TileSet, depot: TrainDepot) {
        super(data, map, tileSet, depot, Validator)
    }
}

export const EighteenSeventeenStateDefinition: EighteenXXStateDefinition = {
    schema: EighteenSeventeenState,
    hydrate: (data, map, tileSet, depot) =>
        new HydratedEighteenSeventeenState(data, map, tileSet, depot)
}
