import type * as Type from 'typebox'
import { AwardShare } from '../actions/awardShare.js'
import { CompleteExpansion } from '../actions/endExpansion.js'
import { PayDividends } from '../actions/payDividends.js'
import { ActionType } from './actions.js'
import { OstbahnApiActions } from './apiActions.js'

export const OstbahnActionSchemas = {
    ...OstbahnApiActions,
    [ActionType.PayDividends]: PayDividends,
    [ActionType.CompleteExpansion]: CompleteExpansion,
    [ActionType.AwardShare]: AwardShare
} satisfies Record<ActionType, Type.TSchema>
