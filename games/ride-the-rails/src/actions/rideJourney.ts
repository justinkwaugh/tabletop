import {
    GameAction,
    HydratableAction,
    MachineContext,
    assert,
    assertExists
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { CityId } from '../data/boardMap.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { isRidingPlayer } from '../rules/riding.js'
import {
    JourneyPayment,
    Link,
    LinksPerRailroad,
    journeyCities,
    journeyExists,
    journeyPayments,
    journeyRefusal,
    paymentTotal
} from '../rules/routes.js'

export type RideJourneyMetadata = Type.Static<typeof RideJourneyMetadata>
export const RideJourneyMetadata = Type.Object({
    startCityId: CityId,
    endCityId: CityId,
    cityIds: Type.Array(CityId),
    linksPerRailroad: LinksPerRailroad,
    payments: Type.Array(JourneyPayment)
})

// R-3.3.1, R-3.3.2, R-X.1: the rider names every link; the engine searches for none.
export type RideJourney = Type.Static<typeof RideJourney>
export const RideJourney = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RideJourney),
            playerId: Type.String(),
            links: Type.Array(Link),
            metadata: Type.Optional(RideJourneyMetadata)
        })
    ])
)

export const RideJourneyValidator = Compile(RideJourney)

export function isRideJourney(action?: GameAction): action is RideJourney {
    return action?.type === ActionType.RideJourney
}

export class HydratedRideJourney
    extends HydratableAction<typeof RideJourney>
    implements RideJourney
{
    declare type: ActionType.RideJourney
    declare playerId: string
    declare links: Link[]
    declare metadata?: RideJourneyMetadata

    constructor(data: RideJourney) {
        super(data, RideJourneyValidator)
    }

    // R-3.3.3 to R-3.3.6
    apply(state: HydratedRideTheRailsGameState, _context?: MachineContext) {
        assert(isRidingPlayer(state, this.playerId), 'It is not your journey')
        const refusal = journeyRefusal(state, this.links)
        assert(refusal === undefined, `That journey is refused: ${refusal}`)

        const cityIds = journeyCities(this.links)
        const startCityId = cityIds[0]
        const endCityId = cityIds.at(-1)
        assertExists(endCityId, 'A journey ends in a city')
        const { linksPerRailroad, payments } = journeyPayments(
            state.players,
            this.playerId,
            this.links
        )
        for (const payment of payments) {
            state.getPlayerState(payment.playerId).money += paymentTotal(payment)
        }
        state.passengers = state.passengers.filter((cityId) => cityId !== startCityId)

        this.metadata = { startCityId, endCityId, cityIds, linksPerRailroad, payments }
    }

    static canRide(state: HydratedRideTheRailsGameState, playerId: string): boolean {
        return isRidingPlayer(state, playerId) && journeyExists(state)
    }
}
