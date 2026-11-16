import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { placeLocationMarker } from '../map/locationMarkers.js'
import type { CompanyDecisionState } from './companyDecision.js'
import type { PrivateMarkerTerms, PrivatePowerRules } from './privatePowers.js'

export const PlacePrivateMarker = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('PlacePrivateMarker'),
        privateCompanyId: Type.String(),
        locationId: Type.String(),
        /** The revenue center the marker goes on, where the private's terms name centers. */
        nodeId: Type.Optional(Type.String())
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
    declare nodeId?: string
    readonly #powers: PrivatePowerRules
    constructor(data: PlacePrivateMarker, powers: PrivatePowerRules) {
        super(data instanceof HydratedPlacePrivateMarker ? data.dehydrate() : data, Validator)
        this.#powers = powers
    }
    private terms(state: State): PrivateMarkerTerms | undefined {
        const terms = this.#powers.markerTerms?.(state, this.privateCompanyId, this.playerId)
        const placed = terms?.stops
            ? terms.stops.some(
                  (stop) => stop.locationId === this.locationId && stop.nodeId === this.nodeId
              )
            : this.nodeId === undefined
        return this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            terms?.locationIds.includes(this.locationId) &&
            placed
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
            privateCompanyId: this.privateCompanyId,
            ...(this.nodeId ? { nodeId: this.nodeId } : {})
        })
        this.#powers.afterMarker?.(state, this.privateCompanyId, this.locationId, this.nodeId)
    }
}
