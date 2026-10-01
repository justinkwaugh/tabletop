import { ActionSource, MachineContext, createAction } from '@tabletop/common'
import type * as Type from 'typebox'
import type { HydratedOathGameState } from '../model/gameState.js'
import { AnswerConsent, HydratedAnswerConsent } from '../actions/answerConsent.js'
import { CampaignDefeatKills, HydratedCampaignDefeatKills } from '../actions/campaignDefeatKills.js'
import { takeFromGroups } from '../util/force.js'
import type { WarbandGroup } from '../model/campaign.js'

const TEST_ACTION_ENVELOPE = { id: 'a1', gameId: 'game-1', source: ActionSource.User }

export function buildAction<T extends Type.TSchema>(
    schema: T,
    fields: Partial<Type.Static<T>>
): Type.Static<T> {
    return createAction(schema, { ...TEST_ACTION_ENVELOPE, ...fields })
}

export function machineContext(gameState: HydratedOathGameState) {
    return new MachineContext({ gameConfig: {}, gameState })
}

export function answerConsent(
    state: HydratedOathGameState,
    playerId: string,
    granted: boolean
): HydratedAnswerConsent {
    const answer = new HydratedAnswerConsent(buildAction(AnswerConsent, { playerId, granted }))
    answer.apply(state)
    return answer
}

/** R-5.5.2.a — the Citizen asked asks to join, and the defender admits them. */
export function joinDefence(
    state: HydratedOathGameState,
    citizenPlayerId: string,
    defenderPlayerId: string
): HydratedAnswerConsent {
    answerConsent(state, citizenPlayerId, true)
    return answerConsent(state, defenderPlayerId, true)
}

/** R-5.5.6.a — when the defeated defending side has a pick, it takes these losses, or its force in order. */
export function defendingSideChooses(
    state: HydratedOathGameState,
    kills?: WarbandGroup[]
): HydratedCampaignDefeatKills | undefined {
    const chooser = HydratedCampaignDefeatKills.chooserId(state)
    const force = state.campaign?.defendingForce
    if (chooser === undefined || force === undefined) return undefined
    const chosen = new HydratedCampaignDefeatKills(
        buildAction(CampaignDefeatKills, {
            playerId: chooser,
            kills: kills ?? takeFromGroups(force, HydratedCampaignDefeatKills.required(state))
        })
    )
    chosen.apply(state)
    return chosen
}
