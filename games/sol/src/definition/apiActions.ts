import { Convert } from '../actions/convert.js'
import { ActivateBonus } from '../actions/activateBonus.js'
import { Fly } from '../actions/fly.js'
import { Launch } from '../actions/launch.js'
import { ActionType } from './actions.js'
import { Pass } from '../actions/pass.js'
import { DrawCards } from '../actions/drawCards.js'
import { ChooseCard } from '../actions/chooseCard.js'
import { ActivateEffect } from '../actions/activateEffect.js'

export const SolApiActions = {
    [ActionType.Launch]: Launch,
    [ActionType.Fly]: Fly,
    [ActionType.Convert]: Convert,
    [ActionType.ActivateBonus]: ActivateBonus,
    [ActionType.Pass]: Pass,
    [ActionType.DrawCards]: DrawCards,
    [ActionType.ChooseCard]: ChooseCard,
    [ActionType.ActivateEffect]: ActivateEffect
}
