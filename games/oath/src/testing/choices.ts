import type { Color } from '@tabletop/common'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import type { Region, Suit } from '../model/oathEnums.js'
import type { BattlePlanUse } from '../model/battlePlanUse.js'
import type { ModifierUse } from '../util/modifiers.js'
import { PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { buildAction } from './actions.js'

export const yes: PowerChoice = { kind: PowerChoiceKind.Yes }

export function boardWarbands(playerId: string, color: Color, count: number): PowerChoice {
    return {
        kind: PowerChoiceKind.Warbands,
        group: { at: { kind: 'board', playerId }, color, count }
    }
}

export function siteWarbands(siteId: string, color: Color, count: number): PowerChoice {
    return { kind: PowerChoiceKind.Warbands, group: { at: { kind: 'site', siteId }, color, count } }
}

export function bank(suit: Suit): PowerChoice {
    return { kind: PowerChoiceKind.FavorBank, suit }
}

export function player(playerId: string): PowerChoice {
    return { kind: PowerChoiceKind.Player, playerId }
}

export function card(cardId: string): PowerChoice {
    return { kind: PowerChoiceKind.Card, cardId }
}

export function site(siteId: string): PowerChoice {
    return { kind: PowerChoiceKind.Site, siteId }
}

export function region(region: Region): PowerChoice {
    return { kind: PowerChoiceKind.Region, region }
}

export function slot(slotId: string): PowerChoice {
    return { kind: PowerChoiceKind.RelicSlot, slotId }
}

export function facedown(playerId: string, index: number): PowerChoice {
    return { kind: PowerChoiceKind.FacedownAdviser, playerId, index }
}

export function siteTarget(siteId: string): CampaignTarget {
    return { kind: CampaignTargetKind.Site, siteId }
}

export function battlePlanUse(cardId: string): BattlePlanUse {
    return { cardId, powerIndex: powerIndexOf(cardId, PowerTiming.BattlePlan) }
}

export function modifierUse(cardId: string, choices?: PowerChoice[]): ModifierUse {
    return { cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier), choices }
}

export function actionPowerUse(
    playerId: string,
    cardId: string,
    choices?: PowerChoice[]
): HydratedUseActionPower {
    return new HydratedUseActionPower(
        buildAction(UseActionPower, {
            playerId,
            cardId,
            powerIndex: powerIndexOf(cardId, PowerTiming.Action),
            choices
        })
    )
}
