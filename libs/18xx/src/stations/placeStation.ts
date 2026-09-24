import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { settleCashPayments } from '../finance/cashPayments.js'
import {
    StationRequest,
    StationPlacementDetails,
    StationPlacement,
    applyStationPlacement,
    type StationRules,
    type StationPlacementState
} from './stationPlacement.js'
export const PlaceStation = Type.Object(
    {
        ...PlayerAction.properties,
        ...StationRequest.properties,
        type: Type.Literal('PlaceStation'),
        expectedCost: Type.Integer({ minimum: 0 }),
        metadata: Type.Optional(StationPlacementDetails)
    },
    { additionalProperties: false }
)
export type PlaceStation = Type.Static<typeof PlaceStation>
const Validator = Compile(PlaceStation)
export function isPlaceStation(action: GameAction): action is PlaceStation {
    return (
        action instanceof HydratedPlaceStation ||
        (action.type === 'PlaceStation' && Validator.Check(action))
    )
}
export class HydratedPlaceStation
    extends HydratableAction<typeof PlaceStation>
    implements PlaceStation
{
    declare type: 'PlaceStation'
    declare playerId: string
    declare companyId: string
    declare stationId: string
    declare position: PlaceStation['position']
    declare expectedCost: number
    declare metadata?: StationPlacementDetails
    readonly #rules: StationRules
    constructor(data: PlaceStation, rules: StationRules) {
        super(data instanceof HydratedPlaceStation ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    apply(state: HydratedGameState & StationPlacementState): void {
        const placement = new StationPlacement(state, this.#rules)
        assert(
            this.source === ActionSource.User &&
                state.activePlayerIds.includes(this.playerId) &&
                placement.canAct(this.playerId, this.companyId),
            'Only the controlling owner may place a station'
        )
        const result = placement.evaluate(this)
        assert(result.details, result.reason ?? 'Invalid station placement')
        assert(result.details.cost === this.expectedCost, 'Station cost has changed')
        if (result.details.cost)
            settleCashPayments(state, [
                {
                    from: { kind: 'company', companyId: this.companyId },
                    to: { kind: 'bank' },
                    amount: result.details.cost
                }
            ])
        applyStationPlacement(state, result.details)
        state.stationStep!.placedStationIds.push(this.stationId)
        this.metadata = result.details
    }
}
