import { Convert } from '../actions/convert.js'
import { ActivateBonus } from '../actions/activateBonus.js'
import { Fly } from '../actions/fly.js'
import { Launch } from '../actions/launch.js'
import { ActionType } from './actions.js'
import { Pass } from '../actions/pass.js'
import { DrawCards } from '../actions/drawCards.js'
import { ChooseCard } from '../actions/chooseCard.js'
import { ActivateEffect } from '../actions/activateEffect.js'
import { ChooseMove } from '../actions/chooseMove.js'
import { ChooseConvert } from '../actions/chooseConvert.js'
import { ChooseActivate } from '../actions/chooseActivate.js'
import { Invade } from '../actions/invade.js'
import { Hurl } from '../actions/hurl.js'
import { Activate } from '../actions/activate.js'
import { Sacrifice } from '../actions/sacrifice.js'
import { Hatch } from '../actions/hatch.js'
import { Blight } from '../actions/blight.js'
import { Accelerate } from '../actions/accelerate.js'
import { Fuel } from '../actions/fuel.js'
import { Tribute } from '../actions/tribute.js'
import { Metamorphosize } from '../actions/metamorphosize.js'
import { Chain } from '../actions/chain.js'

export const SolApiActions = {
    [ActionType.ChooseMove]: ChooseMove,
    [ActionType.ChooseConvert]: ChooseConvert,
    [ActionType.ChooseActivate]: ChooseActivate,
    [ActionType.Launch]: Launch,
    [ActionType.Fly]: Fly,
    [ActionType.Hurl]: Hurl,
    [ActionType.Activate]: Activate,
    [ActionType.Convert]: Convert,
    [ActionType.ActivateBonus]: ActivateBonus,
    [ActionType.Pass]: Pass,
    [ActionType.DrawCards]: DrawCards,
    [ActionType.ChooseCard]: ChooseCard,
    [ActionType.ActivateEffect]: ActivateEffect,
    [ActionType.Invade]: Invade,
    [ActionType.Sacrifice]: Sacrifice,
    [ActionType.Hatch]: Hatch,
    [ActionType.Blight]: Blight,
    [ActionType.Accelerate]: Accelerate,
    [ActionType.Fuel]: Fuel,
    [ActionType.Tribute]: Tribute,
    [ActionType.Metamorphosize]: Metamorphosize,
    [ActionType.Chain]: Chain
}
