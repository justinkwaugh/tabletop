import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import { StationPosition, sameStationPosition } from '../map/station.js'
import { StationPlacementDetails, applyStationPlacement } from '../stations/stationPlacement.js'
import { recordPrivatePowerUse, type CompanyDecisionState } from './companyDecision.js'
import type { PrivatePowerRules, PrivateTokenTerms } from './privatePowers.js'

export const PlacePrivateToken = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('PlacePrivateToken'),
        privateCompanyId: Type.String(),
        position: StationPosition,
        metadata: Type.Optional(StationPlacementDetails)
    },
    { additionalProperties: false }
)
export type PlacePrivateToken = Type.Static<typeof PlacePrivateToken>
const Validator = Compile(PlacePrivateToken)
export function isPlacePrivateToken(action: GameAction): action is PlacePrivateToken {
    return (
        action instanceof HydratedPlacePrivateToken ||
        (action.type === 'PlacePrivateToken' && Validator.Check(action))
    )
}

/** The station a private's token power places: the company's cheapest one still available. */
export function privateTokenStationId(
    state: CompanyDecisionState,
    companyId: string
): string | undefined {
    return state.stations.find(
        (station) => station.companyId === companyId && station.status === 'available'
    )?.id
}

/**
 * A private's power to place its owning company's next station free, apart from the turn's
 * station placement, as 1894's London shipping does in A12. Used once.
 */
export class HydratedPlacePrivateToken
    extends HydratableAction<typeof PlacePrivateToken>
    implements PlacePrivateToken
{
    declare type: 'PlacePrivateToken'
    declare playerId: string
    declare privateCompanyId: string
    declare position: StationPosition
    declare metadata?: StationPlacementDetails
    readonly #powers: PrivatePowerRules
    constructor(data: PlacePrivateToken, powers: PrivatePowerRules) {
        super(data instanceof HydratedPlacePrivateToken ? data.dehydrate() : data, Validator)
        this.#powers = powers
    }
    private terms(state: CompanyDecisionState): PrivateTokenTerms | undefined {
        const terms = this.#powers.tokenTerms?.(state, this.privateCompanyId, this.playerId)
        return this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            !!privateTokenStationId(state, terms?.companyId ?? '') &&
            terms?.positions.some((position) => sameStationPosition(position, this.position))
            ? terms
            : undefined
    }
    isValid(state: CompanyDecisionState): boolean {
        return !!this.terms(state)
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        const terms = this.terms(state)
        assert(terms, 'This private cannot place a station there now')
        const stationId = privateTokenStationId(state, terms.companyId)
        assertExists(stationId, 'The company has a station to place')
        const details = {
            companyId: terms.companyId,
            stationId,
            position: { ...this.position },
            cost: 0
        }
        applyStationPlacement(state, details)
        recordPrivatePowerUse(state, this.privateCompanyId)
        this.metadata = details
    }
}
