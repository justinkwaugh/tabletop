import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedMagnaGreciaGameState } from '../model/gameState.js'

export type Resupply = Type.Static<typeof Resupply>
export const Resupply = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Resupply),
            playerId: Type.String(),
            roads: Type.Integer({ minimum: 0 }),
            cities: Type.Integer({ minimum: 0 })
        })
    ])
)

export const ResupplyValidator = Compile(Resupply)

export function isResupply(action?: GameAction): action is Resupply {
    return action?.type === ActionType.Resupply
}

export class HydratedResupply extends HydratableAction<typeof Resupply> implements Resupply {
    declare type: ActionType.Resupply
    declare playerId: string
    declare roads: number
    declare cities: number

    constructor(data: Resupply) {
        super(data, ResupplyValidator)
    }

    apply(state: HydratedMagnaGreciaGameState, _context?: MachineContext) {
        if (!this.isValidResupply(state)) {
            throw Error('Invalid Resupply action')
        }
        const player = state.getPlayerState(this.playerId)
        player.stagingRoads -= this.roads
        player.supplyRoads += this.roads
        player.stagingCities -= this.cities
        player.supplyCities += this.cities
        state.activeTurn(this.playerId).resupplied = true
    }

    isValidResupply(state: HydratedMagnaGreciaGameState): boolean {
        const player = state.getPlayerState(this.playerId)
        const total = this.roads + this.cities
        return (
            total > 0 &&
            total <= state.resupplyAllowance(this.playerId) &&
            this.roads <= player.stagingRoads &&
            this.cities <= player.stagingCities
        )
    }

    static canResupply(state: HydratedMagnaGreciaGameState, playerId: string): boolean {
        return state.resupplyAllowance(playerId) > 0
    }
}
