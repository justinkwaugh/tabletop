import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { afterTravelPersistent, reasonPersistentForbidsTravel } from '../util/persistent.js'
import {
    payTolls,
    reasonTollsUnpaid,
    tollsFor,
    travelFreeByToll,
    wayStationRuled
} from '../util/tolls.js'
import {
    flipSecretFacedown,
    reasonFlipInvalid,
    reasonSitesForbidTravel,
    shroudedWoodChooser,
    siteTravelTerms
} from '../util/siteTravel.js'
import { ActionType } from '../definition/actions.js'
import { baseTravelCost } from '../util/travelCost.js'
import {
    foldNumber,
    modifierSummary,
    ModifierUse,
    ModifierUses,
    payModifierCosts,
    resolveModifiers,
    runAfter,
    type ActionPlan
} from '../util/modifiers.js'
import { flipSiteFromVault } from '../util/hiddenInputs.js'
import { nextActionIndex } from '../util/freeActions.js'
import { pawnSiteId, regionOfPawn } from '../util/pawn.js'
import { askQuestion } from '../util/questions.js'
import { PowerQuestionKind } from '../model/question.js'

export type TravelMetadata = Type.Static<typeof TravelMetadata>
export const TravelMetadata = Type.Object({
    fromSiteId: Type.Optional(Type.String()),
    /** R-11.7 */
    destinationChooser: Type.Optional(Type.String()),
    supplySpent: Type.Number(),
    supplyRemaining: Type.Number(),
    /** R-5.6.2 */
    revealedSiteCardId: Type.Optional(Type.String()),
    /** R-2.8.2 */
    relicsRevealed: Type.Optional(Type.Number()),
    /** R-7.4 */
    modifiers: Type.Optional(Type.Array(Type.String())),
    modifierNotes: Type.Optional(Type.Array(Type.String())),
    /** R-4.2 (Special Envoy) */
    endsActPhase: Type.Optional(Type.Boolean()),
    /** R-7.1.4 */
    tollsPaid: Type.Optional(Type.Array(Type.String())),
    /** R-11 */
    siteNotes: Type.Optional(Type.Array(Type.String())),
    secretFlipped: Type.Optional(Type.Boolean())
})

/** The optional payments a Travel carries: the tolls paid and the Buried Giant's flip. */
export type TravelTerms = { tolls: string[]; flipSecret: boolean }

export type Travel = Type.Static<typeof Travel>
export const Travel = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Travel),
            playerId: Type.String(),
            /** R-11.7 — absent when the ruler of the Shrouded Wood being left chooses it. */
            siteId: Type.Optional(Type.String()),
            /** R-7.4 — declared at the start of the action. */
            modifiers: ModifierUses,
            /** R-7.1.4 (Toll Roads, Way Station) */
            tolls: Type.Optional(Type.Array(Type.String(), { maxItems: 8 })),
            /** R-11.12, R-11.13 — for the site that asks. */
            flipSecret: Type.Optional(Type.Boolean()),
            metadata: Type.Optional(TravelMetadata)
        })
    ])
)

export const TravelValidator = Compile(Travel)

export function isTravel(action?: GameAction): action is Travel {
    return action?.type === ActionType.Travel
}

export class HydratedTravel extends HydratableAction<typeof Travel> implements Travel {
    declare type: ActionType.Travel
    declare playerId: string
    declare siteId?: string
    declare modifiers?: ModifierUse[]
    declare tolls?: string[]
    declare flipSecret?: boolean
    declare metadata?: TravelMetadata

    constructor(data: Travel) {
        super(data, TravelValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const chooser = shroudedWoodChooser(state, this.playerId)
        if (chooser !== undefined) {
            this.leaveShroudedWood(state, chooser)
            return
        }
        const siteId = this.siteId
        if (siteId === undefined) throw Error('Cannot travel: no destination is named')
        const player = state.getPlayerState(this.playerId)
        const plan = HydratedTravel.plan(
            state,
            this.playerId,
            siteId,
            this.modifiers,
            this.tolls,
            this.flipSecret
        )
        if (plan.reason) {
            throw Error(`Cannot travel: ${plan.reason}`)
        }
        const { cost, active } = plan
        // R-11.12, R-11.13
        if (this.flipSecret) flipSecretFacedown(state, this.playerId)

        const fromSiteId = pawnSiteId(state, this.playerId)

        // R-7.1.2, R-7.4 — paid at declaration.
        payModifierCosts(state, this.playerId, active)
        // R-7.1.4 (Toll Roads, Way Station) — paid before the move.
        const tollNotes = payTolls(
            state,
            this.playerId,
            { kind: 'travel', toSiteId: siteId },
            this.tolls
        )

        player.spendSupply(cost)
        HydratedTravel.useFreeTravel(state, this.playerId)

        // R-5.6.2
        player.siteId = siteId

        const revealed = state.isSiteFaceup(siteId) ? undefined : flipSiteFromVault(state, siteId)
        this.revealsInfo = revealed !== undefined

        // R-7.4 (Tyrant, Special Envoy) — once the pawn has arrived.
        const after = runAfter(state, this.playerId, active, { destinationSiteId: siteId })
        // R-7.1.4 (Grasping Vines, Boiling Lake)
        const persistent = afterTravelPersistent(state, this.playerId, fromSiteId, siteId)

        this.metadata = {
            fromSiteId,
            supplySpent: cost,
            supplyRemaining: player.supply,
            revealedSiteCardId: revealed?.siteCardId,
            relicsRevealed: revealed?.relicsRevealed ?? 0,
            modifiers: active.length > 0 ? modifierSummary(active) : undefined,
            modifierNotes:
                after.notes.length + persistent.length > 0
                    ? [...after.notes, ...persistent]
                    : undefined,
            endsActPhase: after.endsActPhase || undefined,
            tollsPaid: tollNotes.length > 0 ? tollNotes : undefined,
            siteNotes: plan.siteNotes.length > 0 ? plan.siteNotes : undefined,
            secretFlipped: this.flipSecret || undefined
        }
    }

    // R-11.7 — the Supply is paid now; the ruler's answer moves the pawn.
    private leaveShroudedWood(state: HydratedOathGameState, chooser: string) {
        const reason = HydratedTravel.reasonCannotLeaveShroudedWood(state, this.playerId, this)
        if (reason) throw Error(`Cannot travel: ${reason}`)
        const player = state.getPlayerState(this.playerId)
        const fromSiteId = pawnSiteId(state, this.playerId)
        const cost = HydratedTravel.shroudedWoodCost(state, this.playerId)
        player.spendSupply(cost)
        HydratedTravel.useFreeTravel(state, this.playerId)
        askQuestion(state, this.playerId, {
            kind: PowerQuestionKind.ShroudedWoodDestination,
            cardId: state.siteCardAt(fromSiteId) ?? fromSiteId,
            askedPlayerId: chooser,
            travelerPlayerId: this.playerId,
            fromSiteId
        })
        this.metadata = {
            fromSiteId,
            destinationChooser: chooser,
            supplySpent: cost,
            supplyRemaining: player.supply
        }
    }

    // Second Wind, Brass Horse — the free Travel is this action; a free Campaign may follow it.
    private static useFreeTravel(state: HydratedOathGameState, playerId: string) {
        const player = state.getPlayerState(playerId)
        if (player.freeTravelAtAction !== state.actionCount) return
        delete player.freeTravelAtAction
        if (player.freeCampaignAtAction === state.actionCount) {
            player.freeCampaignAtAction = nextActionIndex(state)
        }
    }

    /** R-11.7 — 2 Supply to leave, or none on a free Travel. */
    static shroudedWoodCost(state: HydratedOathGameState, playerId: string): number {
        return state.getPlayerState(playerId).freeTravelAtAction === state.actionCount
            ? 0
            : siteTravelTerms(
                  state,
                  pawnSiteId(state, playerId),
                  pawnSiteId(state, playerId),
                  0,
                  false
              ).cost
    }

    /** R-11.7 — leaving an enemy's Shrouded Wood names no destination and declares nothing on it. */
    static reasonCannotLeaveShroudedWood(
        state: HydratedOathGameState,
        playerId: string,
        choice: {
            siteId?: string
            modifiers?: readonly ModifierUse[]
            tolls?: readonly string[]
            flipSecret?: boolean
        }
    ): string | undefined {
        if (shroudedWoodChooser(state, playerId) === undefined) {
            return 'no enemy rules the Shrouded Wood you stand at'
        }
        if (choice.siteId !== undefined) return "the Shrouded Wood's ruler chooses where you go"
        if (
            (choice.modifiers?.length ?? 0) > 0 ||
            (choice.tolls?.length ?? 0) > 0 ||
            choice.flipSecret
        ) {
            return "nothing is declared on a Travel whose destination the Shrouded Wood's ruler chooses"
        }
        const cost = HydratedTravel.shroudedWoodCost(state, playerId)
        const supply = state.getPlayerState(playerId).supply
        return supply < cost ? `costs ${cost} Supply, player has ${supply}` : undefined
    }

    static plan(
        state: HydratedOathGameState,
        playerId: string,
        siteId: string,
        modifiers?: readonly ModifierUse[],
        tolls?: readonly string[],
        flipSecret = false
    ): ActionPlan & { siteNotes: string[] } {
        const player = state.getPlayerState(playerId)
        if (shroudedWoodChooser(state, playerId) !== undefined) {
            return {
                reason: "the Shrouded Wood's ruler chooses where you go",
                cost: 0,
                active: [],
                siteNotes: []
            }
        }
        const base = HydratedTravel.costFor(state, playerId, siteId)
        if (base === undefined) {
            return {
                reason: `${siteId} is not a site on the map`,
                cost: 0,
                active: [],
                siteNotes: []
            }
        }
        const here = pawnSiteId(state, playerId)
        if (here === siteId) {
            return {
                reason: 'your pawn already occupies that site',
                cost: base,
                active: [],
                siteNotes: []
            }
        }
        // R-7.1.4 — Vow of Union's "cannot travel from a site you rule".
        const sworn = reasonPersistentForbidsTravel(state, playerId, here, siteId)
        if (sworn) return { reason: sworn, cost: base, active: [], siteNotes: [] }
        const resolved = resolveModifiers(state, playerId, ActionType.Travel, modifiers, {
            destinationSiteId: siteId
        })
        if (resolved.reason)
            return { reason: resolved.reason, cost: base, active: [], siteNotes: [] }
        // Forest Paths, Portal — "ignore the powers of sites", which then ask no secret either.
        const sitesIgnored = resolved.active.some((m) => m.hooks.ignoresSitePowers === true)
        // R-11.8, R-11.13 — the Narrow Pass's must and The Hidden Place's cannot.
        const barred = sitesIgnored
            ? reasonFlipInvalid(state, playerId, false, flipSecret)
            : reasonSitesForbidTravel(state, playerId, here, siteId, flipSecret)
        if (barred) return { reason: barred, cost: base, active: [], siteNotes: [] }
        // R-11.3, R-11.6, R-11.7, R-11.12 — the sites' own prices.
        const siteTerms = sitesIgnored
            ? { cost: base, notes: [] }
            : siteTravelTerms(state, here, siteId, base, flipSecret)
        let cost = foldNumber('supplyCost', siteTerms.cost, state, playerId, resolved.active, {
            destinationSiteId: siteId
        })
        // R-7.1.4 — Toll Roads' demand, Way Station's offer (`util/tolls.ts`).
        const unpaid = reasonTollsUnpaid(
            state,
            playerId,
            { kind: 'travel', toSiteId: siteId },
            tolls
        )
        if (unpaid)
            return { reason: unpaid, cost, active: resolved.active, siteNotes: siteTerms.notes }
        if (
            travelFreeByToll(state, playerId, siteId, tolls) ||
            wayStationRuled(state, playerId, siteId)
        )
            cost = 0
        // Second Wind — "you may travel … spending no Supply" as the very next action.
        if (player.freeTravelAtAction === state.actionCount) cost = 0
        if (player.supply < cost) {
            return {
                reason: `costs ${cost} Supply, player has ${player.supply}`,
                cost,
                active: resolved.active,
                siteNotes: siteTerms.notes
            }
        }
        return { cost, active: resolved.active, siteNotes: siteTerms.notes }
    }

    static reasonCannotTravel(
        state: HydratedOathGameState,
        playerId: string,
        siteId: string,
        modifiers?: readonly ModifierUse[],
        tolls?: readonly string[],
        flipSecret = false
    ): string | undefined {
        return HydratedTravel.plan(state, playerId, siteId, modifiers, tolls, flipSecret).reason
    }

    static costFor(
        state: HydratedOathGameState,
        playerId: string,
        siteId: string
    ): number | undefined {
        if (!state.allSiteIds().includes(siteId)) return undefined
        return baseTravelCost(regionOfPawn(state, playerId), state.regionOf(siteId))
    }

    /**
     * R-7.1.4, R-11.12, R-X.1 — every legal pairing of the player's optional travel payments:
     * Way Station's favor instead of Supply, and the Buried Giant's flipped secret. Demanded
     * tolls are in every pairing.
     */
    static legalTerms(
        state: HydratedOathGameState,
        playerId: string,
        siteId: string,
        modifiers?: readonly ModifierUse[]
    ): TravelTerms[] {
        const available = tollsFor(state, playerId, { kind: 'travel', toSiteId: siteId })
        const demanded = available.filter((t) => !t.discount).map((t) => t.cardId)
        const tollSets = [
            demanded,
            ...available.filter((t) => t.discount).map((t) => [...demanded, t.cardId])
        ]
        return tollSets
            .flatMap((tolls) => [false, true].map((flipSecret) => ({ tolls, flipSecret })))
            .filter(
                (terms) =>
                    HydratedTravel.plan(
                        state,
                        playerId,
                        siteId,
                        modifiers,
                        terms.tolls,
                        terms.flipSecret
                    ).reason === undefined
            )
    }

    /** R-5.6.1 */
    static legalDestinations(
        state: HydratedOathGameState,
        playerId: string,
        modifiers?: readonly ModifierUse[]
    ): string[] {
        return state
            .allSiteIds()
            .filter(
                (siteId) => HydratedTravel.legalTerms(state, playerId, siteId, modifiers).length > 0
            )
    }

    static canDoTravel(state: HydratedOathGameState, playerId: string): boolean {
        if (shroudedWoodChooser(state, playerId) !== undefined) {
            return HydratedTravel.reasonCannotLeaveShroudedWood(state, playerId, {}) === undefined
        }
        return HydratedTravel.legalDestinations(state, playerId).length > 0
    }
}
