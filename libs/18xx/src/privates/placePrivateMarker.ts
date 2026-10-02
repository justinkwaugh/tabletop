import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    PlayerAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { placeLocationMarker } from '../map/locationMarkers.js'
import type { CompanyDecisionState } from './companyDecision.js'
import type { PrivatePowerRules } from './privatePowers.js'

export const PlacePrivateMarker = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('PlacePrivateMarker'),
        privateCompanyId: Type.String(),
        locationId: Type.String()
    },
    { additionalProperties: false }
)
export type PlacePrivateMarker = Type.Static<typeof PlacePrivateMarker>
const Validator = Compile(PlacePrivateMarker)
export function isPlacePrivateMarker(action: GameAction): action is PlacePrivateMarker {
    return (
        action instanceof HydratedPlacePrivateMarker ||
        (action.type === 'PlacePrivateMarker' && Validator.Check(action))
    )
}

type State = CompanyDecisionState

export class HydratedPlacePrivateMarker
    extends HydratableAction<typeof PlacePrivateMarker>
    implements PlacePrivateMarker
{
    declare type: 'PlacePrivateMarker'
    declare playerId: string
    declare privateCompanyId: string
    declare locationId: string
    readonly #powers: PrivatePowerRules
    constructor(data: PlacePrivateMarker, powers: PrivatePowerRules) {
        super(data instanceof HydratedPlacePrivateMarker ? data.dehydrate() : data, Validator)
        this.#powers = powers
    }
    isValid(state: State): boolean {
        return (
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            !!this.#powers
                .markerTerms?.(state, this.privateCompanyId, this.playerId)
                ?.locationIds.includes(this.locationId)
        )
    }
    apply(state: HydratedGameState & State): void {
        assert(this.isValid(state), 'This private cannot mark that location now')
        const terms = this.#powers.markerTerms?.(state, this.privateCompanyId, this.playerId)
        assert(terms, 'A private marks a location by its terms')
        placeLocationMarker(state, {
            locationId: this.locationId,
            kind: terms.kind,
            privateCompanyId: this.privateCompanyId
        })
    }
}
