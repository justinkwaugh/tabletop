import type * as Type from 'typebox'
import { LoseValue } from '../actions/loseValue.js'
import { ScoreHuts } from '../actions/scoreHuts.js'
import { ScoreIsland } from '../actions/scoreIsland.js'
import { ActionType } from './actions.js'
import { KaivaiApiActions } from './apiActions.js'

export const KaivaiActionSchemas = {
    ...KaivaiApiActions,
    [ActionType.LoseValue]: LoseValue,
    [ActionType.ScoreHuts]: ScoreHuts,
    [ActionType.ScoreIsland]: ScoreIsland
} satisfies Record<ActionType, Type.TSchema>
