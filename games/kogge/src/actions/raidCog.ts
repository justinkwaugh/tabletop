import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export type RaidCog = Type.Static<typeof RaidCog>
export const RaidCog = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RaidCog),
            playerId: Type.String(),
            victimId: Type.String(),
            metadata: Type.Optional(Type.Object({ city: Type.Integer({ minimum: 0 }) }))
        })
    ])
)

export const RaidCogValidator = Compile(RaidCog)

export function isRaidCog(action?: GameAction): action is RaidCog {
    return action?.type === ActionType.RaidCog
}

export class HydratedRaidCog extends HydratableAction<typeof RaidCog> implements RaidCog {
    declare type: ActionType.RaidCog
    declare playerId: string
    declare victimId: string
    declare metadata?: { city: number }

    constructor(data: RaidCog) {
        super(data, RaidCogValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        if (!state.raidableCogs(this.playerId).includes(this.victimId)) {
            throw Error('Invalid RaidCog action')
        }
        const raid = state.beginRaid(this.playerId)
        raid.victimId = this.victimId
        this.metadata = { city: raid.city }
    }

    static canRaidCog(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.raidableCogs(playerId).length > 0
    }
}
