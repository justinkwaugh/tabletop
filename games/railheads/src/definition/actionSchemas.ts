import type * as Type from 'typebox'
import { EndRound } from '../actions/endRound.js'
import { ResolveIndustryAuction } from '../actions/resolveIndustryAuction.js'
import { ScoreGame } from '../actions/scoreGame.js'
import { ActionType } from './actions.js'
import { RailheadsApiActions } from './apiActions.js'

export const RailheadsActionSchemas = {
    ...RailheadsApiActions,
    [ActionType.ResolveIndustryAuction]: ResolveIndustryAuction,
    [ActionType.EndRound]: EndRound,
    [ActionType.ScoreGame]: ScoreGame
} satisfies Record<ActionType, Type.TSchema>
