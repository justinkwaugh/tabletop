import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import { HydratedAdvance, isAdvance } from '../actions/advance.js'
import { HydratedAssignLosses, isAssignLosses } from '../actions/assignLosses.js'
import { HydratedAttach, isAttach } from '../actions/attach.js'
import { HydratedChooseSide, isChooseSide } from '../actions/chooseSide.js'
import { HydratedCounterAttack, isCounterAttack } from '../actions/counterAttack.js'
import { HydratedDeclareAttack, isDeclareAttack } from '../actions/declareAttack.js'
import { HydratedDeclareDefense, isDeclareDefense } from '../actions/declareDefense.js'
import { HydratedDeclareFeint, isDeclareFeint } from '../actions/declareFeint.js'
import { HydratedDeployArmy, isDeployArmy } from '../actions/deployArmy.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedMove, isMove } from '../actions/move.js'
import { HydratedOccupy, isOccupy } from '../actions/occupy.js'
import { HydratedPassBid, isPassBid } from '../actions/passBid.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedPressAttack, isPressAttack } from '../actions/pressAttack.js'
import { HydratedRegroup, isRegroup } from '../actions/regroup.js'
import { HydratedRetreat, isRetreat } from '../actions/retreat.js'
import { HydratedThreatenAttack, isThreatenAttack } from '../actions/threatenAttack.js'
import {
    HydratedNapoleonsTriumphGameState,
    type NapoleonsTriumphProjectedState
} from '../model/gameState.js'

export class NapoleonsTriumphHydrator implements GameHydrator<
    NapoleonsTriumphProjectedState,
    HydratedNapoleonsTriumphGameState
> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isPlaceBid(data):
                return new HydratedPlaceBid(data)
            case isPassBid(data):
                return new HydratedPassBid(data)
            case isChooseSide(data):
                return new HydratedChooseSide(data)
            case isDeployArmy(data):
                return new HydratedDeployArmy(data)
            case isMove(data):
                return new HydratedMove(data)
            case isAttach(data):
                return new HydratedAttach(data)
            case isThreatenAttack(data):
                return new HydratedThreatenAttack(data)
            case isDeclareDefense(data):
                return new HydratedDeclareDefense(data)
            case isDeclareFeint(data):
                return new HydratedDeclareFeint(data)
            case isPressAttack(data):
                return new HydratedPressAttack(data)
            case isDeclareAttack(data):
                return new HydratedDeclareAttack(data)
            case isCounterAttack(data):
                return new HydratedCounterAttack(data)
            case isAssignLosses(data):
                return new HydratedAssignLosses(data)
            case isRegroup(data):
                return new HydratedRegroup(data)
            case isAdvance(data):
                return new HydratedAdvance(data)
            case isRetreat(data):
                return new HydratedRetreat(data)
            case isOccupy(data):
                return new HydratedOccupy(data)
            case isEndTurn(data):
                return new HydratedEndTurn(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: NapoleonsTriumphProjectedState): HydratedNapoleonsTriumphGameState {
        return new HydratedNapoleonsTriumphGameState(state)
    }
}
