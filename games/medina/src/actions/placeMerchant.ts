import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Point, samePoint } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMedinaGameState } from '../model/gameState.js'

export type PlaceMerchantMetadata = Type.Static<typeof PlaceMerchantMetadata>
export const PlaceMerchantMetadata = Type.Object({
    newStreet: Type.Boolean()
})

export type PlaceMerchant = Type.Static<typeof PlaceMerchant>
export const PlaceMerchant = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceMerchant),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceMerchantMetadata),
            coords: Point
        })
    ])
)

export const PlaceMerchantValidator = Compile(PlaceMerchant)

export function isPlaceMerchant(action?: GameAction): action is PlaceMerchant {
    return action?.type === ActionType.PlaceMerchant
}

export class HydratedPlaceMerchant
    extends HydratableAction<typeof PlaceMerchant>
    implements PlaceMerchant
{
    declare type: ActionType.PlaceMerchant
    declare playerId: string
    declare metadata?: PlaceMerchantMetadata
    declare coords: Point

    constructor(data: PlaceMerchant) {
        super(data, PlaceMerchantValidator)
    }

    apply(state: HydratedMedinaGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        if (
            player.merchantsLeft() <= 0 ||
            !state.merchantSpaces().some((space) => samePoint(space, this.coords))
        ) {
            throw Error('Invalid PlaceMerchant action')
        }
        const streets = state.marketStreets.length
        state.addMerchant(this.coords)
        player.merchants = player.merchantsLeft() - 1
        this.metadata = { newStreet: state.marketStreets.length > streets }
    }
}
