import { spendFavor, usableFavor } from '../util/favor.js'
import { RecoverTargetKind, Banner, Suit } from '../model/oathEnums.js'
export { RecoverTargetKind }
import { siteLockedFor } from '../util/locked.js'
import { burnFavor } from '../util/burn.js'
import {
    afterRelicsTakenPersistent,
    afterBannerRecoveredPersistent,
    reasonPersistentForbidsBannerTake
} from '../util/persistent.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { siteRecoverCost, suitOf, type RecoverCost } from '../data/cardRegistry.js'
import { redistributeFavor } from '../data/favorBanks.js'
import {
    foldNumber,
    mandatoryModifiers,
    ModifierUses,
    payModifierCosts,
    resolveModifiers,
    runAfter,
    type ActiveModifier,
    type ModifierUse
} from '../util/modifiers.js'
import { takeRelicFromVault } from '../util/hiddenInputs.js'
import { takeRelic, clearSiteRelicSlot } from '../util/relics.js'
import { pawnSiteId } from '../powers/vocabulary.js'
import {
    favorPayment,
    modifierPayment,
    reasonCannotPayInAll,
    secretPayment
} from '../util/actionPayment.js'

/** R-5.4.1 */
export const RECOVER_SUPPLY_COST = 1

export type RecoverMetadata = Type.Static<typeof RecoverMetadata>
export const RecoverMetadata = Type.Object({
    supplySpent: Type.Number(),
    relicCardId: Type.Optional(Type.String()),
    /** R-7.4 (Relic Worship) */
    modifierNotes: Type.Optional(Type.Array(Type.String())),
    /** R-5.4.2 */
    amountPaid: Type.Optional(Type.Number()),
    /** R-5.4.4 — in order. */
    favorRedistributedTo: Type.Optional(Type.Array(Type.Enum(Suit))),
    /** R-5.4.4 */
    secretsToPreviousHolder: Type.Optional(Type.Number())
})

export type RecoverTarget = Type.Static<typeof RecoverTarget>
export const RecoverTarget = Type.Union([
    Type.Object({
        kind: Type.Literal(RecoverTargetKind.Relic),
        /** R-2.8.2 — a slot, not a card id; the card is secret. */
        slotId: Type.String()
    }),
    Type.Object({
        kind: Type.Literal(RecoverTargetKind.Banner),
        banner: Type.Enum(Banner)
    })
])

export type Recover = Type.Static<typeof Recover>
export const Recover = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Recover),
            playerId: Type.String(),
            target: RecoverTarget,
            amountPaid: Type.Optional(Type.Integer({ minimum: 0, maximum: 999 })),
            redistributeFrom: Type.Optional(Type.Enum(Suit)),
            /** R-7.4 — declared with the action (Magician's Code). */
            modifiers: ModifierUses,
            metadata: Type.Optional(RecoverMetadata)
        })
    ])
)

export const RecoverValidator = Compile(Recover)

export function isRecover(action?: GameAction): action is Recover {
    return action?.type === ActionType.Recover
}

export class HydratedRecover extends HydratableAction<typeof Recover> implements Recover {
    declare type: ActionType.Recover
    declare playerId: string
    declare target: RecoverTarget
    declare amountPaid?: number
    declare modifiers?: ModifierUse[]
    declare redistributeFrom?: Suit
    declare metadata?: RecoverMetadata

    constructor(data: Recover) {
        super(data, RecoverValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const player = state.getPlayerState(this.playerId)
        const reason = HydratedRecover.reasonCannotRecover(state, this.playerId, this)
        if (reason) {
            throw Error(`Cannot recover: ${reason}`)
        }
        // R-5.4.1
        player.spendSupply(RECOVER_SUPPLY_COST)

        if (this.target.kind === RecoverTargetKind.Relic) {
            this.revealsInfo = true
            this.recoverRelic(state, this.target.slotId)
            return
        }

        this.recoverBanner(state, this.target.banner)
    }

    /** R-5.4.2, R-5.4.3 */
    private recoverRelic(state: HydratedOathGameState, slotId: string) {
        const siteId = pawnSiteId(state, this.playerId)
        // R-2.8.4 — the cost is printed on the site card.
        const cost = siteRecoverCost(state.siteCardAt(siteId))
        assertExists(cost, `Site ${siteId} prints no Recover cost`)

        HydratedRecover.payRecoverCost(state, this.playerId, cost)

        clearSiteRelicSlot(state, siteId, slotId)

        const relicCardId = takeRelicFromVault(state, slotId)
        takeRelic(state, this.playerId, relicCardId)

        // R-7.4 (Relic Worship) — a relic Recover runs only the mandatory modifiers.
        const after = runAfter(
            state,
            this.playerId,
            mandatoryModifiers(state, this.playerId, ActionType.Recover),
            { cardId: relicCardId }
        )
        // R-7.1.4 — "after a player takes any relics" (Relic Thief).
        after.notes.push(...afterRelicsTakenPersistent(state, this.playerId, [relicCardId]))

        this.metadata = {
            supplySpent: RECOVER_SUPPLY_COST,
            relicCardId,
            modifierNotes: after.notes.length > 0 ? after.notes : undefined
        }
    }

    /** R-5.4.2, R-5.4.3, R-5.4.4 */
    private recoverBanner(state: HydratedOathGameState, banner: Banner) {
        const player = state.getPlayerState(this.playerId)
        const bannerState = state.banners[banner]
        const paid = this.amountPaid ?? 0
        // R-7.4 (Magician's Code)
        const active = resolveModifiers(state, this.playerId, ActionType.Recover, this.modifiers, {
            banner
        }).active
        payModifierCosts(state, this.playerId, active)
        const stacked = HydratedRecover.secretsStacked(state, this.playerId, banner, paid, active)
        const previousValue = bannerState.value
        const previousHolderId = bannerState.holderPlayerId

        // R-5.4.3 — take it. Deliberately no R-2.5.3 penalty: R-10.23 makes a
        // Seize "taking in any way except Recover", and this is the exception.
        bannerState.holderPlayerId = this.playerId

        if (banner === Banner.PeoplesFavor) {
            // R-5.4.4
            spendFavor(state, this.playerId, paid)
            bannerState.value = paid
            bannerState.mobSide = false

            assertExists(
                this.redistributeFrom,
                'R-5.4.4 needs the bank the scattered favor starts from'
            )
            const banks = redistributeFavor(this.redistributeFrom, previousValue)
            for (const suit of banks) {
                state.favorBank[suit] += 1
            }

            this.metadata = {
                supplySpent: RECOVER_SUPPLY_COST,
                amountPaid: paid,
                favorRedistributedTo: banks
            }
            return
        }

        player.secrets -= paid
        bannerState.value = stacked
        // R-7.1.4 — Vow of Silence: its holders gain what was placed.
        const triggered = afterBannerRecoveredPersistent(state, this.playerId, banner, paid)

        const takenByRecoverer = HydratedRecover.recoveringFromSelf(this.playerId, previousHolderId)
            ? previousValue // R-5.4.4 — from yourself, you keep them all
            : Math.min(1, previousValue)
        const toPreviousHolder = previousValue - takenByRecoverer

        player.secrets += takenByRecoverer
        if (toPreviousHolder > 0) {
            if (previousHolderId) {
                state.getPlayerState(previousHolderId).secrets += toPreviousHolder
            }
        }

        this.metadata = {
            supplySpent: RECOVER_SUPPLY_COST,
            amountPaid: paid,
            secretsToPreviousHolder: toPreviousHolder,
            modifierNotes: triggered.length > 0 ? triggered : undefined
        }
    }

    static darkestSecretIsExposed(state: HydratedOathGameState, holderId: string): boolean {
        const holder = state.getPlayerState(holderId)
        const adviserSuits = new Set(
            holder
                .faceupAdviserIds()
                .map((cardId) => suitOf(cardId))
                .filter((suit): suit is Suit => suit !== undefined)
        )
        return state.denizensAt(pawnSiteId(state, holderId)).some((cardId) => {
            const suit = suitOf(cardId)
            return suit !== undefined && !adviserSuits.has(suit)
        })
    }

    static reasonCannotRecover(
        state: HydratedOathGameState,
        playerId: string,
        choice: {
            target: RecoverTarget
            amountPaid?: number
            redistributeFrom?: Suit
            modifiers?: readonly ModifierUse[]
        }
    ): string | undefined {
        const player = state.getPlayerState(playerId)
        if (player.supply < RECOVER_SUPPLY_COST) {
            return `costs ${RECOVER_SUPPLY_COST} Supply, player has ${player.supply}`
        }

        const target = choice.target
        if (target.kind === RecoverTargetKind.Relic) {
            const siteId = pawnSiteId(state, playerId)
            const atSite = state.relicSlotsAt(siteId).some((slot) => slot.slotId === target.slotId)
            if (!atSite) {
                // R-2.3 — Reliquary relics are never at a site.
                return `${target.slotId} is not a relic at your site`
            }
            const cost = siteRecoverCost(state.siteCardAt(siteId))
            if (!cost) {
                return `site ${siteId} has no recorded Recover cost`
            }
            // Ancient Bloodline — "relics at sites you rule are locked" for enemies.
            if (siteLockedFor(state, playerId, siteId)) {
                return `the relics at ${siteId} are locked for you (Ancient Bloodline)`
            }
            return HydratedRecover.reasonCannotPay(state, playerId, cost)
        }

        const banner = target.banner
        const bannerState = state.banners[banner]
        const paid = choice.amountPaid ?? 0
        // R-7.4 (Magician's Code)
        const resolved = resolveModifiers(state, playerId, ActionType.Recover, choice.modifiers, {
            banner
        })
        if (resolved.reason) return resolved.reason
        const stacked = HydratedRecover.secretsStacked(
            state,
            playerId,
            banner,
            paid,
            resolved.active
        )
        // R-7.1.4 — Tome Guardians, Lost Tongue, Vow of Silence, Vow of Renewal.
        const guarded = reasonPersistentForbidsBannerTake(
            state,
            playerId,
            banner,
            bannerState.holderPlayerId
        )
        if (guarded) return guarded

        // R-5.4.2, R-2.5.1 — strictly greater; what a modifier adds counts (Magician's Code).
        if (stacked <= bannerState.value) {
            return `must pay more than the ${bannerState.value} already on the banner`
        }

        if (banner === Banner.PeoplesFavor) {
            const usable = usableFavor(state, playerId)
            if (usable < paid) {
                return `paying ${paid} favor needs ${paid}, player has ${usable}`
            }
            if (!choice.redistributeFrom) {
                // R-5.4.4, R-X.1 — the starting bank is the player's choice.
                return 'must choose which favor bank the old favor starts flowing into'
            }
        } else {
            if (player.secrets < paid) {
                return `paying ${paid} secrets needs ${paid}, player has ${player.secrets}`
            }
            const holderId = bannerState.holderPlayerId
            if (
                holderId &&
                !HydratedRecover.recoveringFromSelf(playerId, holderId) &&
                !HydratedRecover.darkestSecretIsExposed(state, holderId)
            ) {
                return 'every card at the holder site matches one of their advisers'
            }
        }

        return reasonCannotPayInAll(state, playerId, [
            modifierPayment(resolved.active),
            banner === Banner.PeoplesFavor ? favorPayment(paid) : secretPayment(paid)
        ])
    }

    static secretsStacked(
        state: HydratedOathGameState,
        playerId: string,
        banner: Banner,
        paid: number,
        active: readonly ActiveModifier[]
    ): number {
        if (banner !== Banner.DarkestSecret) return paid
        return foldNumber('recoverSecrets', paid, state, playerId, active, { banner })
    }

    static canDoRecover(state: HydratedOathGameState, playerId: string): boolean {
        const relicTargets = state.relicSlotsAt(pawnSiteId(state, playerId)).some(
            (slot) =>
                HydratedRecover.reasonCannotRecover(state, playerId, {
                    target: { kind: RecoverTargetKind.Relic, slotId: slot.slotId }
                }) === undefined
        )
        if (relicTargets) return true

        return Object.values(Banner).some(
            (banner) =>
                HydratedRecover.reasonCannotRecover(state, playerId, {
                    target: { kind: RecoverTargetKind.Banner, banner },
                    amountPaid: state.banners[banner].value + 1,
                    redistributeFrom: Suit.Discord
                }) === undefined
        )
    }

    /** R-5.4.4 */
    private static recoveringFromSelf(playerId: string, holderId?: string): boolean {
        return holderId === playerId
    }

    /** R-5.4.2 */
    private static payRecoverCost(
        state: HydratedOathGameState,
        playerId: string,
        cost: RecoverCost
    ) {
        const player = state.getPlayerState(playerId)
        switch (cost.kind) {
            case 'placeFavorInBank':
                // R-10.4 — placed, so it goes to a suit bank; not the same as burning.
                spendFavor(state, playerId, cost.amount)
                state.favorBank[cost.suit] += cost.amount
                break
            case 'burnFavor':
                // R-10.4 — burned favor goes to the shared bank, not a suit bank.
                spendFavor(state, playerId, cost.amount)
                burnFavor(state, cost.amount)
                break
            case 'burnSecrets':
                // Secrets have no pool to return to (R-9.3); they leave play.
                player.secrets -= cost.amount
                break
        }
    }

    private static reasonCannotPay(
        state: HydratedOathGameState,
        playerId: string,
        cost: RecoverCost
    ): string | undefined {
        const player = state.getPlayerState(playerId)
        // R-7.1.2.a — facedown secrets cannot pay a cost.
        const available =
            cost.kind === 'burnSecrets' ? player.secrets : usableFavor(state, playerId)
        const currency = cost.kind === 'burnSecrets' ? 'secrets' : 'favor'
        if (available < cost.amount) {
            return `costs ${cost.amount} ${currency}, player has ${available}`
        }
        return undefined
    }
}
