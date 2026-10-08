import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { BonusChit, GOODS_PER_BONUS_CHIT } from '../components/bonusChits.js'
import { Good, goodCounts } from '../components/goods.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'
import { TurnAction } from '../model/turn.js'

export type ClaimBonusChit = Type.Static<typeof ClaimBonusChit>
export const ClaimBonusChit = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ClaimBonusChit),
            playerId: Type.String(),
            good: Type.Enum(Good),
            chit: Type.Enum(BonusChit)
        })
    ])
)

export const ClaimBonusChitValidator = Compile(ClaimBonusChit)

export function isClaimBonusChit(action?: GameAction): action is ClaimBonusChit {
    return action?.type === ActionType.ClaimBonusChit
}

export class HydratedClaimBonusChit
    extends HydratableAction<typeof ClaimBonusChit>
    implements ClaimBonusChit
{
    declare type: ActionType.ClaimBonusChit
    declare playerId: string
    declare good: Good
    declare chit: BonusChit

    constructor(data: ClaimBonusChit) {
        super(data, ClaimBonusChitValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        if (!state.canClaimBonusChit(this.playerId, this.good, this.chit)) {
            throw Error('Invalid ClaimBonusChit action')
        }
        const player = state.getPlayerState(this.playerId)
        state.pay(player, { goods: goodCounts({ [this.good]: GOODS_PER_BONUS_CHIT }), markers: [] })
        state.bonusSupply.splice(state.bonusSupply.indexOf(this.chit), 1)
        player.bonusChits.push(this.chit)
        state.recordTurnAction(this.playerId, TurnAction.GuildMasterTrade)
    }

    static canClaimBonusChit(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.bonusChitGoods(playerId).length > 0 && state.bonusSupply.length > 0
    }
}
