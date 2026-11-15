import type * as Type from 'typebox'
import { CalculateMarket } from '../actions/calculateMarket.js'
import { EndYear } from '../actions/endYear.js'
import { GrowSunflowers } from '../actions/growSunflowers.js'
import { Harvest } from '../actions/harvest.js'
import { MoveCompost } from '../actions/moveCompost.js'
import { ReactSoil } from '../actions/reactSoil.js'
import { ReadMessage } from '../actions/readMessage.js'
import { RevealPlans } from '../actions/revealPlans.js'
import { ScoreGame } from '../actions/scoreGame.js'
import { SellPotatoes } from '../actions/sellPotatoes.js'
import { ActionType } from './actions.js'
import { DickeKartoffelnApiActions } from './apiActions.js'

export const DickeKartoffelnActionSchemas = {
    ...DickeKartoffelnApiActions,
    [ActionType.RevealPlans]: RevealPlans,
    [ActionType.GrowSunflowers]: GrowSunflowers,
    [ActionType.ReadMessage]: ReadMessage,
    [ActionType.Harvest]: Harvest,
    [ActionType.CalculateMarket]: CalculateMarket,
    [ActionType.SellPotatoes]: SellPotatoes,
    [ActionType.ReactSoil]: ReactSoil,
    [ActionType.MoveCompost]: MoveCompost,
    [ActionType.EndYear]: EndYear,
    [ActionType.ScoreGame]: ScoreGame
} satisfies Record<ActionType, Type.TSchema>
