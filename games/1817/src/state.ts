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
    seedMoney: Type.Optional(Type.Integer({ minimum: 0 })),
    shortSqueeze: Type.Optional(Type.Literal(true)),
    fiveShorts: Type.Optional(Type.Literal(true))
})
const Validator = Compile(EighteenSeventeenState)

/** The optional rules chosen when the game was set up. */
export function eighteenSeventeenOptions(state: object): {
    shortSqueeze: boolean
    fiveShorts: boolean
} {
    return { shortSqueeze: 'shortSqueeze' in state, fiveShorts: 'fiveShorts' in state }
}

export class HydratedEighteenSeventeenState extends HydratedEighteenXXState {
    declare seedMoney?: number
    declare shortSqueeze?: true
    declare fiveShorts?: true
    constructor(data: EighteenXXState, map: RailwayMap, tileSet: TileSet, depot: TrainDepot) {
        super(data, map, tileSet, depot, Validator)
    }
}

export const EighteenSeventeenStateDefinition: EighteenXXStateDefinition = {
    schema: EighteenSeventeenState,
    hydrate: (data, map, tileSet, depot) =>
        new HydratedEighteenSeventeenState(data, map, tileSet, depot)
}
