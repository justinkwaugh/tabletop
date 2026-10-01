import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    HydratedEighteenXXState,
    PrivateSaleFields,
    StockTurnPurchaseFields,
    extendEighteenXXState,
    type EighteenXXState,
    type EighteenXXStateDefinition,
    type PrivateSaleOffer,
    type RailwayMap,
    type StockTurnPurchase,
    type TileSet,
    type TrainDepot
} from '@tabletop/18xx'

const EighteenThirtyState = extendEighteenXXState({
    ...StockTurnPurchaseFields,
    ...PrivateSaleFields,
    // Set at setup when the game allows several brown-zone shares from the IPO in one turn.
    multipleBrownFromIpo: Type.Optional(Type.Literal(true))
})
const Validator = Compile(EighteenThirtyState)

export class HydratedEighteenThirtyState extends HydratedEighteenXXState {
    declare stockTurnPurchases?: StockTurnPurchase[]
    declare privateSaleOffer?: PrivateSaleOffer
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
