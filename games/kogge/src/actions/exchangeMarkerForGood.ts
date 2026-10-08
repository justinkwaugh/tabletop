import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { markerGood } from '../components/routeMarkers.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'
import { TurnAction } from '../model/turn.js'

export type ExchangeMarkerForGood = Type.Static<typeof ExchangeMarkerForGood>
export const ExchangeMarkerForGood = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ExchangeMarkerForGood),
            playerId: Type.String(),
            value: Type.Integer({ minimum: 0 })
        })
    ])
)

export const ExchangeMarkerForGoodValidator = Compile(ExchangeMarkerForGood)

export function isExchangeMarkerForGood(action?: GameAction): action is ExchangeMarkerForGood {
    return action?.type === ActionType.ExchangeMarkerForGood
}

export class HydratedExchangeMarkerForGood
    extends HydratableAction<typeof ExchangeMarkerForGood>
    implements ExchangeMarkerForGood
{
    declare type: ActionType.ExchangeMarkerForGood
    declare playerId: string
    declare value: number

    constructor(data: ExchangeMarkerForGood) {
        super(data, ExchangeMarkerForGoodValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        if (!state.canExchangeMarkerForGood(this.playerId, this.value)) {
            throw Error('Invalid ExchangeMarkerForGood action')
        }
        const player = state.getPlayerState(this.playerId)
        const good = markerGood(this.value)
        player.giveMarkers([this.value])
        state.reserve.returnMarkers([this.value])
        state.supply[good] -= 1
        player.goods[good] += 1
        state.recordTurnAction(this.playerId, TurnAction.GuildMasterTrade)
    }

    static canExchangeMarkerForGood(state: HydratedKoggeGameState, playerId: string): boolean {
        return (
            state.canTradeWithGuildMaster(playerId) &&
            state
                .getPlayerState(playerId)
                .hand()
                .some((value) => state.supply[markerGood(value)] > 0)
        )
    }
}
