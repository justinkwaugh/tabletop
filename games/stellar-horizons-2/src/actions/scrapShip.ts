import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { scrapRefund } from '../model/building.js'
import { removeShip } from '../model/fleet.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnStep } from '../model/turn.js'

export type ScrapShipMetadata = Type.Static<typeof ScrapShipMetadata>
export const ScrapShipMetadata = Type.Object({
    systemId: Type.String(),
    refund: Type.Number(),
    settlementsLost: Type.Number()
})

export type ScrapShip = Type.Static<typeof ScrapShip>
export const ScrapShip = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ScrapShip),
            playerId: Type.String(),
            shipId: Type.String(),
            metadata: Type.Optional(ScrapShipMetadata)
        })
    ])
)

export const ScrapShipValidator = Compile(ScrapShip)

export function isScrapShip(action?: GameAction): action is ScrapShip {
    return action?.type === ActionType.ScrapShip
}

export class HydratedScrapShip extends HydratableAction<typeof ScrapShip> implements ScrapShip {
    declare type: ActionType.ScrapShip
    declare playerId: string
    declare shipId: string
    declare metadata?: ScrapShipMetadata

    constructor(data: ScrapShip) {
        super(data, ScrapShipValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const ship = state.playerShip(this.playerId, this.shipId)
        if (!ship || state.getPlayerState(this.playerId).step === TurnStep.Done) {
            throw Error('Invalid ScrapShip action')
        }
        const refund = scrapRefund(ship)
        state.getPlayerState(this.playerId).cash += refund
        removeShip(state, ship.shipId)
        this.metadata = { systemId: ship.systemId, refund, settlementsLost: ship.settlements }
    }

    static canScrapShip(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return (
            state.getPlayerState(playerId).step !== TurnStep.Done &&
            state.shipsOf(playerId).length > 0
        )
    }
}
