import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import {
    StationPlacement,
    StationPlacementDetails,
    applyStationPlacement,
    type StationPlacementState,
    type StationRules
} from './stationPlacement.js'
const Fields = Type.Object({
    type: Type.Literal('PlaceHomeStations'),
    metadata: Type.Optional(Type.Array(StationPlacementDetails))
})
export const PlaceHomeStations: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof Fields.properties
> = Type.Object({ ...GameAction.properties, ...Fields.properties }, { additionalProperties: false })
export type PlaceHomeStations = Type.Static<typeof PlaceHomeStations>
const Validator = Compile(PlaceHomeStations)
export function isPlaceHomeStations(action: GameAction): action is PlaceHomeStations {
    return (
        action instanceof HydratedPlaceHomeStations ||
        (action.type === 'PlaceHomeStations' && Validator.Check(action))
    )
}
export class HydratedPlaceHomeStations
    extends HydratableAction<typeof PlaceHomeStations>
    implements PlaceHomeStations
{
    declare type: 'PlaceHomeStations'
    declare metadata?: StationPlacementDetails[]
    readonly #rules: StationRules
    constructor(data: PlaceHomeStations, rules: StationRules) {
        super(data instanceof HydratedPlaceHomeStations ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & StationPlacementState): void {
        assert(this.source === ActionSource.System, 'Home stations require a system action')
        const placements = new StationPlacement(state, this.#rules).homePlacements()
        assert(placements.length, 'No home stations are pending')
        for (const placement of placements) applyStationPlacement(state, placement)
        this.metadata = placements
    }
}
