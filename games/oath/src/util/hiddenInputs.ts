import { assertExists } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import {
    discardOnto,
    drawFirstVision,
    drawRelics,
    exchangeWithDispossessed,
    mergeDiscardPiles,
    peekDiscard,
    putUnderWorldDeck,
    returnRelicToBottom,
    topBackType,
    type OathVault
} from '../model/vault.js'
import type { SearchResolve } from '../actions/searchResolve.js'
import type { PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import type { SetupChoice } from '../actions/setupChoice.js'
import type { CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import type { CampaignSacrifice } from '../actions/campaignSacrifice.js'
import type { CampaignDefeatKills } from '../actions/campaignDefeatKills.js'
import type { UseActionPower } from '../actions/useActionPower.js'
import type { UseRestPower } from '../actions/useRestPower.js'
import type { AnswerQuestion } from '../actions/answerQuestion.js'
import type { ResolveCitizenshipOffer } from '../actions/resolveCitizenshipOffer.js'
import { ActionType } from '../definition/actions.js'
import { hiddenRequestFor, isFaceupPlay } from './powerDoorway.js'
import { effectFor } from '../powers/registry.js'
import { powersWithTiming, PowerTiming } from '../data/cardPowers.js'
import type { HiddenRequest, HiddenReveal, PileDeposit } from '../model/hidden.js'
import type { PowerOutcome } from '../model/powerOutcome.js'
import { siteRevealPrompt } from '../data/cardRegistry.js'
import { Region, SearchPlay } from '../model/oathEnums.js'
import { CampaignTargetKind, type CampaignState } from '../model/campaign.js'
import { placeRevealTokensForSite } from '../model/setup.js'
import type { PowerChoice } from './powerChoice.js'
import { homelandRelicSlot } from './sitePowers.js'
import { pawnSiteId } from './pawn.js'
import { grandScepterHolderId } from './imperial.js'

type HiddenOutputAction =
    | UseActionPower
    | UseRestPower
    | AnswerQuestion
    | CampaignSacrifice
    | CampaignDefeatKills
    | CampaignResolveVictory
    | SearchResolve
    | PlayFacedownAdviser
    | SetupChoice
    | ResolveCitizenshipOffer

export interface SiteFlip {
    siteCardId: string
    relicsRevealed: number
}

/** R-5.6.2, R-2.8.2 */
export function flipSiteFromVault(state: HydratedOathGameState, siteId: string): SiteFlip {
    const vault = state.requireVault()
    const siteCardId = vault.siteFacedown[siteId]
    assertExists(siteCardId, `${siteId} was not revealed from the vault`)
    delete vault.siteFacedown[siteId]
    const relics = drawRelics(vault, siteRevealPrompt(siteCardId)?.relics ?? 0)
    const relicSlots = relics.map((relicCardId, index) => {
        const slotId = `${siteId}.relic.${index}`
        vault.relicFacedown[slotId] = relicCardId
        return { slotId }
    })
    state.siteCards = { ...state.siteCards, [siteId]: siteCardId }
    if (relicSlots.length > 0) {
        state.relicsBySite[siteId] = [...state.relicSlotsAt(siteId), ...relicSlots]
    }
    placeRevealTokensForSite(state, siteId)
    return { siteCardId, relicsRevealed: relicSlots.length }
}

/** R-9.4 — a facedown relic leaving concealment for good. */
export function takeRelicFromVault(state: HydratedOathGameState, slotId: string): string {
    const vault = state.requireVault()
    const relicCardId = relicAt(vault, slotId)
    delete vault.relicFacedown[slotId]
    return relicCardId
}

/** R-6.3 — a facedown relic's identity, seen and left where it is. */
export function peekRelicInVault(state: HydratedOathGameState, slotId: string): string {
    return relicAt(state.requireVault(), slotId)
}

/**
 * R-6.4-H1 — the Grand Scepter's holder may peek at any Reliquary relic at will, so they know
 * every one; a new holder learns them all, and a former holder keeps what they saw.
 */
export function teachReliquaryToScepterHolder(state: HydratedOathGameState): boolean {
    const holderId = grandScepterHolderId(state)
    if (holderId === undefined) return false
    const holder = state.getPlayerState(holderId)
    const unseen = state
        .reliquarySlots()
        .filter((slot) => !holder.peekedRelicSlotIds.includes(slot.slotId))
    for (const slot of unseen) holder.recordPeek(slot.slotId, peekRelicInVault(state, slot.slotId))
    return unseen.length > 0
}

/** Relic Hunter */
export function showTakenSiteRelics(
    state: HydratedOathGameState,
    campaign: CampaignState
): boolean {
    const slotIds = campaign.targets.flatMap((target) =>
        target.kind === CampaignTargetKind.SiteRelic ? [target.slotId] : []
    )
    const attacker = state.getPlayerState(campaign.attackerPlayerId)
    for (const slotId of slotIds) attacker.recordPeek(slotId, peekRelicInVault(state, slotId))
    return slotIds.length > 0
}

export function revealForPower(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    powerIndex: number,
    choices: readonly PowerChoice[] | undefined
): HiddenReveal | undefined {
    const request = hiddenRequestFor(state, playerId, cardId, powerIndex, choices)
    return request ? fulfil(request, state) : undefined
}

/** R-7.3.3 — a card played faceup reads the vault for its When Played power; R-11.2-H1, a Homeland's relic. */
export function revealForPlay(
    state: HydratedOathGameState,
    action: SearchResolve | PlayFacedownAdviser
): HiddenReveal | undefined {
    const cardId = action.type === ActionType.SearchResolve ? action.keptCardId : action.cardId
    // R-6.1 plays the adviser faceup.
    const faceUp = action.type === ActionType.PlayFacedownAdviser || action.faceUp
    const power = isFaceupPlay(action.play, faceUp)
        ? powersWithTiming(cardId, PowerTiming.WhenPlayed)[0]
        : undefined
    const request = power
        ? effectFor(power)?.hidden?.({
              state,
              playerId: action.playerId,
              power,
              choices: action.choices ?? []
          })
        : undefined
    if (request) return fulfil(request, state)
    // R-11.2 — any play to a site: a Search's, R-6.1's, or one to another site (New Growth, the People's Favor).
    const slotId =
        action.play === SearchPlay.Site
            ? homelandRelicSlot(
                  state,
                  action.playerId,
                  cardId,
                  action.toSiteId ?? pawnSiteId(state, action.playerId)
              )
            : undefined
    return slotId ? { kind: 'relic', relicCardId: takeRelicFromVault(state, slotId) } : undefined
}

/** Called at the end of `apply`. */
export function commitHiddenOutputs(
    action: HiddenOutputAction,
    state: HydratedOathGameState
): void {
    const vault = state.requireVault()
    switch (action.type) {
        case ActionType.UseActionPower:
        case ActionType.UseRestPower:
            if (action.metadata) commitPowerOutcome(vault, action.metadata)
            return
        case ActionType.AnswerQuestion:
            if (action.metadata?.relicToDeckBottom)
                returnRelicToBottom(vault, action.metadata.relicToDeckBottom)
            if (action.metadata?.relicTakenFromSlotId)
                delete vault.relicFacedown[action.metadata.relicTakenFromSlotId]
            discardRecorded(vault, action.metadata)
            depositOnPiles(vault, action.metadata?.pileDeposits)
            return
        case ActionType.CampaignSacrifice:
        case ActionType.CampaignDefeatKills:
            depositOnPiles(vault, action.metadata?.pileDeposits)
            return
        case ActionType.CampaignResolveVictory:
            for (const id of action.metadata?.relicsToDeckBottom ?? [])
                returnRelicToBottom(vault, id)
            depositOnPiles(vault, action.metadata?.pileDeposits)
            return
        case ActionType.SearchResolve:
            if (!action.metadata) return
            if (action.metadata.discardToWorldDeck === true)
                putUnderWorldDeck(vault, action.metadata.discardedCardIds)
            else
                discardOnto(
                    vault,
                    action.metadata.discardPileRegion,
                    action.metadata.discardedCardIds,
                    action.metadata.discardToBottom === true
                )
            commitPowerOutcome(vault, action.metadata)
            return
        case ActionType.PlayFacedownAdviser:
            if (!action.metadata) return
            discardRecorded(vault, action.metadata)
            commitPowerOutcome(vault, action.metadata)
            return
        case ActionType.SetupChoice:
            discardRecorded(vault, action.metadata)
            return
        case ActionType.ResolveCitizenshipOffer:
            discardRecorded(vault, action.metadata?.outcome)
            return
    }
}

interface RecordedDiscard {
    discardPileRegion?: Region
    discardedCardIds?: string[]
}

function discardRecorded(vault: OathVault, recorded: RecordedDiscard | undefined) {
    if (recorded?.discardPileRegion && recorded.discardedCardIds)
        discardOnto(vault, recorded.discardPileRegion, recorded.discardedCardIds)
}

function commitPowerOutcome(vault: OathVault, outcome: PowerOutcome) {
    if (outcome.relicToDeckBottom) returnRelicToBottom(vault, outcome.relicToDeckBottom)
    if (outcome.relicSlotToBottom) {
        returnRelicToBottom(vault, relicAt(vault, outcome.relicSlotToBottom))
        delete vault.relicFacedown[outcome.relicSlotToBottom]
    }
    if (outcome.mergePiles) mergeDiscardPiles(vault, outcome.mergePiles.from, outcome.mergePiles.to)
    depositOnPiles(vault, outcome.pileDeposits)
}

function depositOnPiles(vault: OathVault, deposits: readonly PileDeposit[] | undefined) {
    for (const deposit of deposits ?? [])
        discardOnto(vault, deposit.region, deposit.cardIds, deposit.bottom === true)
}

/** R-9.4 */
function relicAt(vault: OathVault, slotId: string): string {
    const relicCardId = vault.relicFacedown[slotId]
    assertExists(relicCardId, `No facedown relic is held at ${slotId}`)
    return relicCardId
}

function fulfil(request: HiddenRequest, state: HydratedOathGameState): HiddenReveal {
    const vault = state.requireVault()
    switch (request.kind) {
        case 'relicDraw':
            return { kind: 'relics', relicCardIds: drawRelics(vault, request.count) }
        case 'discardPeek':
            return { kind: 'peek', cardIds: peekDiscard(vault, request.region, request.count) }
        case 'relicAtSlot':
            return { kind: 'relic', relicCardId: takeRelicFromVault(state, request.slotId) }
        case 'relicPeekAtSlot':
            return { kind: 'relic', relicCardId: relicAt(vault, request.slotId) }
        case 'facedownAdviser': {
            const holder = state.getPlayerState(request.playerId)
            const cardId = holder.knownAdviserIds()[request.index]
            assertExists(cardId, `${request.playerId} has no adviser at ${request.index}`)
            return { kind: 'peek', cardIds: [cardId] }
        }
        case 'worldDeckVision': {
            const cardId = drawFirstVision(vault)
            return {
                kind: 'vision',
                cardId,
                topCardBackType: topBackType(vault),
                worldDeckExhausted: vault.worldDeck.length === 0
            }
        }
        case 'worldDeckPeek':
            return { kind: 'peek', cardIds: vault.worldDeck.slice(0, request.count) }
        case 'siteAtSlot':
            return { kind: 'site', siteCardId: vault.siteFacedown[request.slotId] }
        case 'siteFlip':
            return { kind: 'site', siteCardId: flipSiteFromVault(state, request.siteId).siteCardId }
        case 'dispossessedExchange':
            return {
                kind: 'peek',
                cardIds: exchangeWithDispossessed(
                    vault,
                    request.cardIds,
                    state.getProtectedPrng().random
                )
            }
    }
}
