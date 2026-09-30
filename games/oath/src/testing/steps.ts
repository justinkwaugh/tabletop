import type { HydratedOathGameState } from '../model/gameState.js'
import { SearchPlay } from '../model/oathEnums.js'
import type { BattlePlanUse } from '../model/battlePlanUse.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { currentQuestion } from '../util/questions.js'
import { assert } from '@tabletop/common'
import type { PowerChoice } from '../util/powerChoice.js'
import { Campaign, HydratedCampaign } from '../actions/campaign.js'
import { CampaignDefend, HydratedCampaignDefend } from '../actions/campaignDefend.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import {
    CampaignResolveVictory,
    HydratedCampaignResolveVictory
} from '../actions/campaignResolveVictory.js'
import { HydratedSearchResolve, SearchResolve } from '../actions/searchResolve.js'
import { AnswerQuestion, HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import { buildAction, defendingSideChooses } from './actions.js'
import { siteTarget } from './choices.js'
import { FILLER } from './cards.js'

export const ATTACKER = 'attacker'
export const DEFENDER = 'defender'

/** R-5.5.1 — the attacker on the defender at c1 with three attack dice, unless `fields` says otherwise. */
export function campaign(fields: Partial<Campaign> = {}): HydratedCampaign {
    return new HydratedCampaign(
        buildAction(Campaign, {
            playerId: ATTACKER,
            defender: { kind: 'player', playerId: DEFENDER },
            targets: [siteTarget('c1')],
            attackDice: 3,
            ...fields
        })
    )
}

export function defend(plans: BattlePlanUse[], playerId = DEFENDER): HydratedCampaignDefend {
    return new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId, plans }))
}

/** R-5.5.5 to R-5.5.7 — no sacrifice, the defending side's losses, and a victory that takes nothing. */
export function finishCampaign(state: HydratedOathGameState): HydratedCampaignSacrifice {
    return finishCampaignSteps(state).sacrifice
}

/** The same, with the victory's record, where R-5.5.8's "if you're victorious" plans report. */
export function finishCampaignSteps(state: HydratedOathGameState): {
    sacrifice: HydratedCampaignSacrifice
    victory?: HydratedCampaignResolveVictory
} {
    const sacrifice = new HydratedCampaignSacrifice(
        buildAction(CampaignSacrifice, {
            playerId: ATTACKER,
            sacrifice: 0,
            defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(state, 0)
        })
    )
    sacrifice.apply(state)
    defendingSideChooses(state)
    if (!state.campaign) return { sacrifice }
    const victory = new HydratedCampaignResolveVictory(
        buildAction(CampaignResolveVictory, {
            playerId: ATTACKER,
            placements: [],
            burnFavor: false
        })
    )
    victory.apply(state)
    return { sacrifice, victory }
}

export function answerQuestion(
    state: HydratedOathGameState,
    playerId: string,
    answer: QuestionAnswer
): HydratedAnswerQuestion {
    const action = new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId, answer }))
    action.apply(state)
    return action
}

/** Law Glossary "Discard" — the open order question answered in the order its cards are listed. */
export function discardInListedOrder(state: HydratedOathGameState): HydratedAnswerQuestion {
    const question = currentQuestion(state)
    assert(question?.kind === PowerQuestionKind.OrderDiscards, 'an OrderDiscards question is open')
    return answerQuestion(state, question.askedPlayerId, {
        kind: PowerQuestionKind.OrderDiscards,
        order: question.cardIds.map((_, position) => position)
    })
}

/** R-5.1.3 — `cardId` and the filler were drawn; `cardId` is kept and played, faceup as an adviser. */
export function playDrawnCard(
    state: HydratedOathGameState,
    cardId: string,
    to: SearchPlay,
    choices?: PowerChoice[],
    playerId = 'ruler'
): HydratedSearchResolve {
    state.getPlayerState(playerId).handIds = [cardId, FILLER]
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, {
            playerId,
            keptCardId: cardId,
            discardOrder: [FILLER],
            play: to,
            faceUp: to === SearchPlay.Adviser ? true : undefined,
            choices
        })
    )
    action.apply(state)
    return action
}
