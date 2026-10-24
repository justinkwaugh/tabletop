import type { HydratedAction } from '@tabletop/common'
import { HydratedBuyCard, isBuyCard } from '../actions/buyCard.js'
import {
    HydratedChooseEndRollModifier,
    endRollModifierChoices,
    isChooseEndRollModifier
} from '../actions/chooseEndRollModifier.js'
import { HydratedDevelopTech, isDevelopTech } from '../actions/developTech.js'
import { ActionType } from '../definition/actions.js'
import { canBuyAnyCard, canDevelopAnyTech } from '../model/development.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { PlayStateHandler } from './playing.js'

type DevelopingAction = HydratedDevelopTech | HydratedBuyCard | HydratedChooseEndRollModifier

export class DevelopingStateHandler extends PlayStateHandler<DevelopingAction> {
    protected readonly phase = TurnPhase.Development

    protected isPhaseAction(action: HydratedAction): action is DevelopingAction {
        return isDevelopTech(action) || isBuyCard(action) || isChooseEndRollModifier(action)
    }

    protected phaseActions(playerId: string, state: HydratedStellarHorizonsGameState) {
        return [
            ...(canDevelopAnyTech(state, playerId) ? [ActionType.DevelopTech] : []),
            ...(canBuyAnyCard(state, playerId) ? [ActionType.BuyCard] : []),
            ...(endRollModifierChoices(state, playerId).length > 0
                ? [ActionType.ChooseEndRollModifier]
                : [])
        ]
    }
}
