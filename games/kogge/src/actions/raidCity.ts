import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { GoodCounts } from '../components/goods.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export type RaidCity = Type.Static<typeof RaidCity>
export const RaidCity = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RaidCity),
            playerId: Type.String(),
            metadata: Type.Optional(
                Type.Object({
                    city: Type.Integer({ minimum: 0 }),
                    loot: GoodCounts
                })
            )
        })
    ])
)

export const RaidCityValidator = Compile(RaidCity)

export function isRaidCity(action?: GameAction): action is RaidCity {
    return action?.type === ActionType.RaidCity
}

// Rulebook 3f: robbing a city takes every good there, including those in its offices.
export class HydratedRaidCity extends HydratableAction<typeof RaidCity> implements RaidCity {
    declare type: ActionType.RaidCity
    declare playerId: string
    declare metadata?: { city: number; loot: GoodCounts }

    constructor(data: RaidCity) {
        super(data, RaidCityValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        if (!state.canRaid(this.playerId)) {
            throw Error('Invalid RaidCity action')
        }
        const city = state.cogCity(this.playerId)
        const loot = state.lootCity(this.playerId)
        state.beginRaid(this.playerId)
        this.metadata = { city: city.number, loot }
    }

    static canRaidCity(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.canRaid(playerId)
    }
}
