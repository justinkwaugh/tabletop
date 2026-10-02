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
import type { PrivateMarkerTerms, PrivatePowerRules } from './privatePowers.js'

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
    private terms(state: State): PrivateMarkerTerms | undefined {
        const terms = this.#powers.markerTerms?.(state, this.privateCompanyId, this.playerId)
        return this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            terms?.locationIds.includes(this.locationId)
            ? terms
            : undefined
    }
    isValid(state: State): boolean {
        return !!this.terms(state)
    }
    apply(state: HydratedGameState & State): void {
        const terms = this.terms(state)
        assert(terms, 'This private cannot mark that location now')
        placeLocationMarker(state, {
            locationId: this.locationId,
            kind: terms.kind,
            privateCompanyId: this.privateCompanyId
        })
    }
}
