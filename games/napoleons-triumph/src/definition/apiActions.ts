import { ActionType } from './actions.js'
import { Advance } from '../actions/advance.js'
import { AssignLosses } from '../actions/assignLosses.js'
import { Attach } from '../actions/attach.js'
import { ChooseSide } from '../actions/chooseSide.js'
import { CounterAttack } from '../actions/counterAttack.js'
import { DeclareAttack } from '../actions/declareAttack.js'
import { DeclareDefense } from '../actions/declareDefense.js'
import { DeclareFeint } from '../actions/declareFeint.js'
import { DeployArmy } from '../actions/deployArmy.js'
import { EndTurn } from '../actions/endTurn.js'
import { Move } from '../actions/move.js'
import { Occupy } from '../actions/occupy.js'
import { PassBid } from '../actions/passBid.js'
import { PlaceBid } from '../actions/placeBid.js'
import { PressAttack } from '../actions/pressAttack.js'
import { Regroup } from '../actions/regroup.js'
import { Retreat } from '../actions/retreat.js'
import { ThreatenAttack } from '../actions/threatenAttack.js'

export const NapoleonsTriumphApiActions = {
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.PassBid]: PassBid,
    [ActionType.ChooseSide]: ChooseSide,
    [ActionType.DeployArmy]: DeployArmy,
    [ActionType.Move]: Move,
    [ActionType.Attach]: Attach,
    [ActionType.ThreatenAttack]: ThreatenAttack,
    [ActionType.DeclareDefense]: DeclareDefense,
    [ActionType.DeclareFeint]: DeclareFeint,
    [ActionType.PressAttack]: PressAttack,
    [ActionType.DeclareAttack]: DeclareAttack,
    [ActionType.CounterAttack]: CounterAttack,
    [ActionType.AssignLosses]: AssignLosses,
    [ActionType.Regroup]: Regroup,
    [ActionType.Advance]: Advance,
    [ActionType.Retreat]: Retreat,
    [ActionType.Occupy]: Occupy,
    [ActionType.EndTurn]: EndTurn
}
