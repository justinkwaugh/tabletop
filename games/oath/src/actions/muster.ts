import { spendFavor, usableFavor } from '../util/favor.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { WarbandOwner } from '../model/warbandCounts.js'
import { reasonCannotPlaceOn } from '../util/powerCost.js'
import { musterWarbandsBonus } from '../util/continuous.js'
import { riverMusterBonus } from '../util/sitePowers.js'
import { gainWarbandsWithOwner, warbandOwnerGainedBy, warbandsInBankFor } from '../util/force.js'
import { reasonPersistentForbidsMuster } from '../util/persistent.js'
import {
    anyRelaxesOccupancy,
    firstForbid,
    foldNumber,
    foldSupplyCost,
    modifierSummary,
    ModifierUse,
    ModifierUses,
    payModifierCosts,
    resolveModifiers,
    runAfter,
    type ActionPlan,
    type ActiveModifier
} from '../util/modifiers.js'
import { pawnSiteId } from '../util/pawn.js'
import {
    favorPayment,
    modifierPayment,
    reasonCannotPayInAll,
    secretPayment
} from '../util/actionPayment.js'

/** R-5.2.1 */
export const MUSTER_SUPPLY_COST = 1
/** R-5.2.2 */
export const MUSTER_WARBANDS = 2

export type MusterMetadata = Type.Static<typeof MusterMetadata>
export const MusterMetadata = Type.Object({
    supplySpent: Type.Number(),
    warbandsGained: Type.Number(),
    warbandOwner: WarbandOwner,
    /** R-7.4 */
    modifiers: Type.Optional(Type.Array(Type.String())),
    /** R-7.4 */
    modifierNotes: Type.Optional(Type.Array(Type.String()))
})

export type Muster = Type.Static<typeof Muster>
export const Muster = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Muster),
            playerId: Type.String(),
            cardId: Type.String(),
            /** R-7.4 — declared at the start of the action. */
            modifiers: ModifierUses,
            metadata: Type.Optional(MusterMetadata)
        })
    ])
)

export const MusterValidator = Compile(Muster)

export function isMuster(action?: GameAction): action is Muster {
    return action?.type === ActionType.Muster
}

export class HydratedMuster extends HydratableAction<typeof Muster> implements Muster {
    declare type: ActionType.Muster
    declare playerId: string
    declare cardId: string
    declare modifiers?: ModifierUse[]
    declare metadata?: MusterMetadata

    constructor(data: Muster) {
        super(data, MusterValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const player = state.getPlayerState(this.playerId)
        const plan = HydratedMuster.plan(state, this.playerId, this.cardId, this.modifiers)
        if (plan.reason) {
            throw Error(`Cannot muster: ${plan.reason}`)
        }
        const { cost, active } = plan
        const particulars = { cardId: this.cardId }

        // R-7.1.2, R-7.4 — paid at declaration.
        payModifierCosts(state, this.playerId, active)

        // R-5.2.1
        player.spendSupply(cost)
        if (HydratedMuster.placesSecret(active)) {
            player.secrets -= 1
            state.addTokensOn(this.cardId, { secrets: 1 })
        } else {
            spendFavor(state, this.playerId, 1)
            state.addTokensOn(this.cardId, { favor: 1 })
        }

        const owner = HydratedMuster.warbandOwnerFor(state, this.playerId)
        const { gained } = gainWarbandsWithOwner(
            state,
            this.playerId,
            HydratedMuster.wanted(state, this.playerId, this.cardId, active),
            owner
        )

        // R-7.4
        const after = runAfter(state, this.playerId, active, particulars)

        this.metadata = {
            supplySpent: cost,
            warbandsGained: gained,
            warbandOwner: owner,
            modifiers: active.length > 0 ? modifierSummary(active) : undefined,
            modifierNotes: after.notes.length > 0 ? after.notes : undefined
        }
    }

    /** R-5.2.2 — a Citizen musters the Empire's warbands, from the Chancellor's bank (R-10.13). */
    static warbandOwnerFor(state: HydratedOathGameState, playerId: string): WarbandOwner {
        return warbandOwnerGainedBy(state, playerId)
    }

    /** R-5.2.2, R-7.4, R-7.1.4-H1 (Ring of Devotion), R-11.5 (River): the warbands asked for. */
    static wanted(
        state: HydratedOathGameState,
        playerId: string,
        cardId: string,
        active: readonly ActiveModifier[]
    ): number {
        return (
            foldNumber('musterWarbands', MUSTER_WARBANDS, state, playerId, active, { cardId }) +
            musterWarbandsBonus(state, playerId) +
            riverMusterBonus(state, playerId)
        )
    }

    /** R-9.3 — the warbands left in the bank a Muster draws from. */
    static available(state: HydratedOathGameState, playerId: string): number {
        return warbandsInBankFor(state, HydratedMuster.warbandOwnerFor(state, playerId))
    }

    /** Initiation Rite — "you must place a secret instead of favor". */
    static placesSecret(active: readonly ActiveModifier[]): boolean {
        return active.some((m) => m.hooks.musterPlacesSecret)
    }

    static plan(
        state: HydratedOathGameState,
        playerId: string,
        cardId: string,
        modifiers?: readonly ModifierUse[]
    ): ActionPlan {
        const none: ActionPlan = { cost: MUSTER_SUPPLY_COST, active: [] }
        const player = state.getPlayerState(playerId)
        const siteId = pawnSiteId(state, playerId)
        const particulars = { cardId }
        const resolved = resolveModifiers(
            state,
            playerId,
            ActionType.Muster,
            modifiers,
            particulars
        )
        if (resolved.reason) return { ...none, reason: resolved.reason }
        const active = resolved.active
        const cost = foldSupplyCost(MUSTER_SUPPLY_COST, state, playerId, active, particulars)
        const forbidden = firstForbid(state, playerId, active, particulars)
        if (forbidden) return { cost, active, reason: forbidden }
        if (player.supply < cost) {
            return { cost, active, reason: `costs ${cost} Supply, player has ${player.supply}` }
        }
        const placesSecret = HydratedMuster.placesSecret(active)
        if (placesSecret && player.secrets < 1)
            return {
                cost,
                active,
                reason: 'requires one secret to place on the card (Initiation Rite)'
            }
        if (!placesSecret && usableFavor(state, playerId) < 1)
            return { cost, active, reason: 'requires one favor to place on the card' }
        const unaffordable = reasonCannotPayInAll(state, playerId, [
            modifierPayment(active),
            placesSecret ? secretPayment(1) : favorPayment(1)
        ])
        if (unaffordable) return { cost, active, reason: unaffordable }
        // R-7.1.4 — a persistent "cannot muster from …" (Forest Council).
        const persistent = reasonPersistentForbidsMuster(state, playerId, cardId)
        if (persistent) return { cost, active, reason: persistent }
        if (!state.isMusterableCard(siteId, cardId)) {
            return {
                cost,
                active,
                reason: `${cardId} is not a denizen at your site`
            }
        }
        // R-7.1.2.a — Pressgangs lifts it.
        if (!anyRelaxesOccupancy(state, playerId, active)) {
            const occupied = reasonCannotPlaceOn(state, cardId)
            if (occupied) return { cost, active, reason: occupied }
        }
        return { cost, active }
    }

    static reasonCannotMuster(
        state: HydratedOathGameState,
        playerId: string,
        cardId: string,
        modifiers?: readonly ModifierUse[]
    ): string | undefined {
        return HydratedMuster.plan(state, playerId, cardId, modifiers).reason
    }

    /** R-5.2, R-7.4 — judged with the modifiers the player has declared. */
    static legalCards(
        state: HydratedOathGameState,
        playerId: string,
        modifiers?: readonly ModifierUse[]
    ): string[] {
        return state
            .denizensAt(pawnSiteId(state, playerId))
            .filter(
                (cardId) =>
                    HydratedMuster.reasonCannotMuster(state, playerId, cardId, modifiers) ===
                    undefined
            )
    }

    static canDoMuster(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedMuster.legalCards(state, playerId).length > 0
    }
}
