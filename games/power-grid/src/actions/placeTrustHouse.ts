import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { TRUST, type HydratedPowerGridGameState } from '../model/gameState.js'

export type PlaceTrustHouse = Type.Static<typeof PlaceTrustHouse>
export const PlaceTrustHouse = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceTrustHouse),
            playerId: Type.String(),
            cityId: Type.String()
        })
    ])
)

export const PlaceTrustHouseValidator = Compile(PlaceTrustHouse)

export function isPlaceTrustHouse(action?: GameAction): action is PlaceTrustHouse {
    return action?.type === ActionType.PlaceTrustHouse
}

/** Recharged p. 9: the players take turns placing the Trust's six houses on adjacent cities. */
export class HydratedPlaceTrustHouse
    extends HydratableAction<typeof PlaceTrustHouse>
    implements PlaceTrustHouse
{
    declare type: ActionType.PlaceTrustHouse
    declare playerId: string
    declare cityId: string

    constructor(data: PlaceTrustHouse) {
        super(data, PlaceTrustHouseValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        const trust = state.trust
        assertExists(trust, 'Placing a Trust house needs the Trust')
        if (
            state.trustPlacer() !== this.playerId ||
            !state.trustPlacementTargets().includes(this.cityId)
        ) {
            throw Error('Invalid PlaceTrustHouse action')
        }
        state.cities[this.cityId] = [TRUST]
        trust.startingCities.push(this.cityId)
        trust.housesLeft -= 1
    }
}
