import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { goodCounts } from '../components/goods.js'
import { markerGood } from '../components/routeMarkers.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'
import { TurnAction } from '../model/turn.js'

export type ExchangeGoodForMarker = Type.Static<typeof ExchangeGoodForMarker>
export const ExchangeGoodForMarker = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ExchangeGoodForMarker),
            playerId: Type.String(),
            value: Type.Integer({ minimum: 0 })
        })
    ])
)

export const ExchangeGoodForMarkerValidator = Compile(ExchangeGoodForMarker)

export function isExchangeGoodForMarker(action?: GameAction): action is ExchangeGoodForMarker {
    return action?.type === ActionType.ExchangeGoodForMarker
}

// Designer ruling (BGG thread 345412): the player picks any marker of the good's colour
// from the reserve.
export class HydratedExchangeGoodForMarker
    extends HydratableAction<typeof ExchangeGoodForMarker>
    implements ExchangeGoodForMarker
{
    declare type: ActionType.ExchangeGoodForMarker
    declare playerId: string
    declare value: number

    constructor(data: ExchangeGoodForMarker) {
        super(data, ExchangeGoodForMarkerValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        const good = markerGood(this.value)
        if (!state.canExchangeGoodForMarker(this.playerId, good, this.value)) {
            throw Error('Invalid ExchangeGoodForMarker action')
        }
        const player = state.getPlayerState(this.playerId)
        state.pay(player, { goods: goodCounts({ [good]: 1 }), markers: [] })
        state.reserve.takeValue(this.value)
        player.takeMarkers([this.value])
        state.recordTurnAction(this.playerId, TurnAction.GuildMasterTrade)
    }

    static canExchangeGoodForMarker(state: HydratedKoggeGameState, playerId: string): boolean {
        return (
            state.canTradeWithGuildMaster(playerId) &&
            state.getPlayerState(playerId).cargoCount() > 0 &&
            state.reserve.count() > 0
        )
    }
}
