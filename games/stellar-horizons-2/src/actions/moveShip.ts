import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { canMoveAnyShip, endIdleMovement, moveOptions } from '../model/movement.js'
import { TurnStep } from '../model/turn.js'

export type MoveShipMetadata = Type.Static<typeof MoveShipMetadata>
export const MoveShipMetadata = Type.Object({
    fromSystemId: Type.String(),
    turns: Type.Number()
})

export type MoveShip = Type.Static<typeof MoveShip>
export const MoveShip = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MoveShip),
            playerId: Type.String(),
            shipId: Type.String(),
            systemId: Type.String(),
            metadata: Type.Optional(MoveShipMetadata)
        })
    ])
)

export const MoveShipValidator = Compile(MoveShip)

export function isMoveShip(action?: GameAction): action is MoveShip {
    return action?.type === ActionType.MoveShip
}

export class HydratedMoveShip extends HydratableAction<typeof MoveShip> implements MoveShip {
    declare type: ActionType.MoveShip
    declare playerId: string
    declare shipId: string
    declare systemId: string
    declare metadata?: MoveShipMetadata

    constructor(data: MoveShip) {
        super(data, MoveShipValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const ship = state.playerShip(this.playerId, this.shipId)
        const option = ship
            ? moveOptions(state, ship).find((candidate) => candidate.systemId === this.systemId)
            : undefined
        if (!ship || !option || state.getPlayerState(this.playerId).step !== TurnStep.Movement) {
            throw Error('Invalid MoveShip action')
        }
        this.metadata = { fromSystemId: ship.systemId, turns: option.turns }
        ship.systemId = this.systemId
        ship.transit = option.turns
        endIdleMovement(state, this.playerId)
    }

    static canMoveShip(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return (
            state.getPlayerState(playerId).step === TurnStep.Movement &&
            canMoveAnyShip(state, playerId)
        )
    }
}
