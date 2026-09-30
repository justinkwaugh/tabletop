import { giveFavor } from '../util/favor.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    Visibility,
    assert,
    assertExists
} from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { WarbandGroup } from '../model/campaign.js'
import { Banner, Region } from '../model/oathEnums.js'
import { ConsentRequestKind } from '../model/consent.js'
import { CitizenshipTerms, CitizenshipTransfer } from '../model/citizenship.js'
import {
    availableImperialWarbands,
    reliquarySlot,
    uncoveredReliquarySpaces
} from '../util/imperial.js'
import {
    becomeCitizen,
    citizenshipEndsActPhase,
    citizenshipReplacementGroups
} from '../util/citizenship.js'
import { forceTotal, selectionExceedsForce } from '../util/force.js'
import { giveBanner } from '../util/seize.js'
import { reasonTermsInvalid } from './offerCitizenship.js'
import { commitHiddenOutputs, takeRelicFromVault } from '../util/hiddenInputs.js'
import { moveRelic, takeRelic, clearReliquarySlot } from '../util/relics.js'

export type CitizenshipOutcome = Type.Static<typeof CitizenshipOutcome>
export const CitizenshipOutcome = Type.Object({
    relicCardId: Type.Optional(Type.String()),
    reliquarySpacesUncovered: Type.Number(),
    replacedCount: Type.Number(),
    unreplacedCount: Type.Number(),
    discardedCardIds: Visibility.protect(Type.Array(Type.String()), {
        policy: Visibility.Policy.Actor
    }),
    discardPileRegion: Type.Optional(Type.Enum(Region)),
    flippedUsurperToOathkeeper: Type.Boolean(),
    // R-6.6.2 — applied by ConsentRequestStateHandler.
    endsActPhase: Type.Boolean(),
    givenBanners: Type.Array(Type.Enum(Banner))
})

export type ResolveCitizenshipOfferMetadata = Type.Static<typeof ResolveCitizenshipOfferMetadata>
export const ResolveCitizenshipOfferMetadata = Type.Object({
    granted: Type.Boolean(),
    // Carried on the action because the engine writes machineState after onAction returns.
    resumeMachineState: Type.Enum(MachineState),
    outcome: Type.Optional(CitizenshipOutcome)
})

export type ResolveCitizenshipOffer = Type.Static<typeof ResolveCitizenshipOffer>
export const ResolveCitizenshipOffer = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ResolveCitizenshipOffer),
            playerId: Type.String(),
            granted: Type.Boolean(),
            replacementChoice: Type.Optional(Type.Array(WarbandGroup, { maxItems: 64 })),
            metadata: Type.Optional(ResolveCitizenshipOfferMetadata)
        })
    ])
)

export const ResolveCitizenshipOfferValidator = Compile(ResolveCitizenshipOffer)

export function isResolveCitizenshipOffer(action?: GameAction): action is ResolveCitizenshipOffer {
    return action?.type === ActionType.ResolveCitizenshipOffer
}

export class HydratedResolveCitizenshipOffer
    extends HydratableAction<typeof ResolveCitizenshipOffer>
    implements ResolveCitizenshipOffer
{
    declare type: ActionType.ResolveCitizenshipOffer
    declare playerId: string
    declare granted: boolean
    declare replacementChoice?: WarbandGroup[]
    declare metadata?: ResolveCitizenshipOfferMetadata

    constructor(data: ResolveCitizenshipOffer) {
        super(data, ResolveCitizenshipOfferValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedResolveCitizenshipOffer.reasonCannotResolve(
            state,
            this.playerId,
            this
        )
        if (reason) {
            throw Error(`Cannot answer the Citizenship offer: ${reason}`)
        }

        const pending = state.pendingConsent
        assertExists(pending, 'no Citizenship offer is open')
        const request = pending.request
        assert(
            request.kind === ConsentRequestKind.CitizenshipOffer,
            `pending consent is ${request.kind}, not a Citizenship offer`
        )
        const resumeMachineState = pending.resumeMachineState
        assertExists(resumeMachineState, 'A Citizenship offer resumes the turn that made it')

        state.pendingConsent = undefined

        if (!this.granted) {
            this.revealsInfo = false
            this.metadata = { granted: false, resumeMachineState }
            return
        }

        const slot = reliquarySlot(state, request.reliquarySlotId)
        assertExists(slot, `${request.reliquarySlotId} is not an occupied Reliquary space`)

        // R-X.3: the relic's identity comes out of the vault.
        this.revealsInfo = true

        const conversion = becomeCitizen(state, this.playerId, this.replacementChoice)

        // R-X.3(b): the discarded Vision is replayed into the vault, which is never rolled back.
        if (conversion.discardedVisionId) {
            this.revealsInfo = true
        }

        const relicCardId = takeRelicFromVault(state, request.reliquarySlotId)
        clearReliquarySlot(state, request.reliquarySlotId)
        takeRelic(state, this.playerId, relicCardId)

        const givenBanners = HydratedResolveCitizenshipOffer.applyTerms(
            state,
            pending.askingPlayerId,
            this.playerId,
            request.terms
        )

        this.metadata = {
            granted: true,
            resumeMachineState,
            outcome: {
                relicCardId,
                reliquarySpacesUncovered: uncoveredReliquarySpaces(state),
                replacedCount: conversion.replacedCount,
                unreplacedCount: conversion.unreplacedCount,
                discardedCardIds: conversion.discardedVisionId
                    ? [conversion.discardedVisionId]
                    : [],
                discardPileRegion: conversion.discardPileRegion,
                flippedUsurperToOathkeeper: conversion.flippedUsurperToOathkeeper,
                endsActPhase: citizenshipEndsActPhase(state, this.playerId),
                givenBanners
            }
        }
        commitHiddenOutputs(this, state)
    }

    static reasonCannotResolve(
        state: HydratedOathGameState,
        playerId: string,
        choice: { granted: boolean; replacementChoice?: readonly WarbandGroup[] }
    ): string | undefined {
        const pending = state.pendingConsent
        if (!pending || pending.request.kind !== ConsentRequestKind.CitizenshipOffer) {
            return 'no Citizenship offer is open'
        }
        if (playerId !== pending.askedPlayerId) {
            return `the offer was made to ${pending.askedPlayerId}, not to ${playerId}`
        }

        if (!choice.granted) {
            if (choice.replacementChoice && choice.replacementChoice.length > 0) {
                return 'a refusal chooses no warbands'
            }
            return undefined
        }

        const request = pending.request
        if (!reliquarySlot(state, request.reliquarySlotId)) {
            return `${request.reliquarySlotId} is not an occupied space in the Imperial Reliquary`
        }

        const terms = reasonTermsInvalid(state, pending.askingPlayerId, playerId, request.terms)
        if (terms) return terms

        return HydratedResolveCitizenshipOffer.reasonReplacementChoiceInvalid(
            state,
            playerId,
            choice.replacementChoice
        )
    }

    static canDoResolveCitizenshipOffer(state: HydratedOathGameState, playerId: string): boolean {
        const pending = state.pendingConsent
        return (
            pending?.request.kind === ConsentRequestKind.CitizenshipOffer &&
            pending.askedPlayerId === playerId
        )
    }

    private static applyTerms(
        state: HydratedOathGameState,
        scepterHolderId: string,
        exileId: string,
        terms?: CitizenshipTerms
    ): Banner[] {
        const given: Banner[] = []
        const move = (fromId: string, toId: string, transfer?: CitizenshipTransfer) => {
            if (!transfer) return
            const from = state.getPlayerState(fromId)
            const to = state.getPlayerState(toId)

            giveFavor(state, fromId, toId, transfer.favor ?? 0)

            const secrets = transfer.secrets ?? 0
            from.secrets -= secrets
            to.secrets += secrets

            for (const cardId of transfer.relicCardIds ?? []) {
                moveRelic(state, fromId, toId, cardId)
            }

            for (const banner of transfer.banners ?? []) {
                giveBanner(state, banner, toId)
                given.push(banner)
            }
        }

        move(scepterHolderId, exileId, terms?.fromScepterHolder)
        move(exileId, scepterHolderId, terms?.fromExile)
        return given
    }

    private static reasonReplacementChoiceInvalid(
        state: HydratedOathGameState,
        exileId: string,
        choice?: readonly WarbandGroup[]
    ): string | undefined {
        const all = citizenshipReplacementGroups(state, exileId)
        const wanted = forceTotal(all)
        const available = availableImperialWarbands(state)

        if (available >= wanted) {
            if (choice && choice.length > 0) {
                return 'the Empire has Imperial warbands enough to replace every warband, so there is nothing to choose'
            }
            return undefined
        }

        if (!choice || choice.length === 0) {
            return `only ${available} Imperial warbands are available for ${wanted} warbands; the Exile must choose which are replaced`
        }
        const exceeds = selectionExceedsForce(choice, all)
        if (exceeds) return exceeds
        const chosen = forceTotal(choice)
        if (chosen !== available) {
            // R-9.3: "as many as possible", so the count is fixed even though the allocation is free.
            return `must choose exactly ${available} warbands to replace, not ${chosen}`
        }
        return undefined
    }
}
