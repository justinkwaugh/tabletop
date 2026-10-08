import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'
import {
    GUILD_MASTER_GOODS,
    GUILD_MASTER_STEP_CHOICES,
    finishesGame,
    guildMasterPath
} from '../model/guildMaster.js'
import { takeFromSupply } from '../model/supplies.js'
import { cityGood } from '../components/cities.js'

export type MoveGuildMaster = Type.Static<typeof MoveGuildMaster>
export const MoveGuildMaster = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MoveGuildMaster),
            playerId: Type.String(),
            steps: Type.Integer({ minimum: 1, maximum: 2 }),
            metadata: Type.Optional(
                Type.Object({
                    stops: Type.Array(Type.Integer({ minimum: 0 })),
                    goodsPlaced: Type.Integer({ minimum: 0 }),
                    endsGame: Type.Boolean()
                })
            )
        })
    ])
)

export const MoveGuildMasterValidator = Compile(MoveGuildMaster)

export function isMoveGuildMaster(action?: GameAction): action is MoveGuildMaster {
    return action?.type === ActionType.MoveGuildMaster
}

export class HydratedMoveGuildMaster
    extends HydratableAction<typeof MoveGuildMaster>
    implements MoveGuildMaster
{
    declare type: ActionType.MoveGuildMaster
    declare playerId: string
    declare steps: number
    declare metadata?: { stops: number[]; goodsPlaced: number; endsGame: boolean }

    constructor(data: MoveGuildMaster) {
        super(data, MoveGuildMasterValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        if (
            !HydratedMoveGuildMaster.canMoveGuildMaster(state, this.playerId) ||
            !GUILD_MASTER_STEP_CHOICES.includes(this.steps)
        ) {
            throw Error('Invalid MoveGuildMaster action')
        }
        const path = guildMasterPath(state.guildMaster, state.cities, this.steps)
        const destination = path.stops[path.stops.length - 1]
        state.guildMaster.city = destination
        state.guildMaster.distance += path.distance
        const good = cityGood(destination)
        const goodsPlaced = takeFromSupply(state.supply, good, GUILD_MASTER_GOODS)
        state.city(destination).goods[good] += goodsPlaced
        this.metadata = {
            stops: path.stops,
            goodsPlaced,
            endsGame: finishesGame(state.guildMaster)
        }
    }

    static canMoveGuildMaster(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.turnManager.turnOrder[0] === playerId
    }
}
