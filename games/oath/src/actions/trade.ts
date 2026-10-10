import { gainFavorFromBank, spendFavor, usableFavor } from '../util/favor.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    assert,
    assertExists
} from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Suit } from '../model/oathEnums.js'
import { suitOf } from '../data/cardRegistry.js'
import { reasonCannotPlaceOn } from '../util/powerCost.js'
import { cannotGainFavorFromTrade } from '../util/continuous.js'
import { advisersOfSuit, reasonPersistentForbidsTrade } from '../util/persistent.js'
import { payTolls, reasonTollsUnpaid } from '../util/tolls.js'
import { defaultTolls } from '../util/tollDefaults.js'
import { pawnSiteId } from '../util/pawn.js'
import { OathRevision, isAtLeastOathRevision } from '../util/revision.js'
import {
    favorPayment,
    modifierPayment,
    reasonCannotPayInAll,
    secretPayment,
    tollPayment
} from '../util/actionPayment.js'
import {
    foldNumber,
    foldSupplyCost,
    modifierContext,
    modifierSummary,
    ModifierUse,
    ModifierUses,
    payModifierCosts,
    resolveModifiers,
    disguisedAs,
    runAfter,
    runBefore,
    type ActiveModifier,
    type ActionPlan
} from '../util/modifiers.js'

/** R-5.3.1 */
export const TRADE_SUPPLY_COST = 1

/** R-5.3.2 */
export enum TradeOption {
    ForFavor = 'forFavor',
    ForSecrets = 'forSecrets'
}

export type TradeMetadata = Type.Static<typeof TradeMetadata>
export const TradeMetadata = Type.Object({
    supplySpent: Type.Number(),
    matchingAdvisers: Type.Number(),
    favorGained: Type.Number(),
    secretsGained: Type.Number(),
    /** R-7.4 */
    modifiers: Type.Optional(Type.Array(Type.String())),
    modifierNotes: Type.Optional(Type.Array(Type.String())),
    /** R-7.1.4 (Curfew) */
    tollsPaid: Type.Optional(Type.Array(Type.String()))
})

export type Trade = Type.Static<typeof Trade>
export const Trade = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Trade),
            playerId: Type.String(),
            cardId: Type.String(),
            option: Type.Enum(TradeOption),
            /** R-7.4 — declared at the start of the action. */
            modifiers: ModifierUses,
            /** R-7.1.4 (Curfew) */
            tolls: Type.Optional(Type.Array(Type.String(), { maxItems: 8 })),
            metadata: Type.Optional(TradeMetadata)
        })
    ])
)

export const TradeValidator = Compile(Trade)

export function isTrade(action?: GameAction): action is Trade {
    return action?.type === ActionType.Trade
}

export class HydratedTrade extends HydratableAction<typeof Trade> implements Trade {
    declare type: ActionType.Trade
    declare playerId: string
    declare cardId: string
    declare option: TradeOption
    declare tolls?: string[]
    declare modifiers?: ModifierUse[]
    declare metadata?: TradeMetadata

    constructor(data: Trade) {
        super(data, TradeValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const player = state.getPlayerState(this.playerId)
        const plan = HydratedTrade.plan(
            state,
            this.playerId,
            this.cardId,
            this.option,
            this.modifiers,
            this.tolls
        )
        if (plan.reason) {
            throw Error(`Cannot trade: ${plan.reason}`)
        }
        // R-7.1.4 — Curfew's toll, paid before anything else is placed.
        const tollNotes = payTolls(
            state,
            this.playerId,
            { kind: 'trade', cardId: this.cardId },
            this.tolls
        )
        const { cost, active } = plan
        const particulars = {
            cardId: this.cardId,
            tradeOption: this.option,
            advisersOf: disguisedAs(ActionType.Trade, this.modifiers)
        }

        const suit = suitOf(this.cardId)
        assertExists(suit, `${this.cardId} has no suit`)
        const matching = HydratedTrade.matchingAdvisers(state, this.playerId, this.cardId, active)

        // R-7.1.2 — the price includes side-effects ("if you sacrifice one warband").
        payModifierCosts(state, this.playerId, active)
        const notes = runBefore(state, this.playerId, active, particulars)

        // R-5.3.1
        player.spendSupply(cost)

        const forFavor = this.option === TradeOption.ForFavor
        if (forFavor) {
            if (isAtLeastOathRevision(state, OathRevision.CostsAndFacedownModifiers))
                assert(player.secrets >= 1, `${this.playerId} has no secret left to place`)
            player.secrets -= 1
            state.addTokensOn(this.cardId, { secrets: 1 })
        } else {
            spendFavor(state, this.playerId, 2)
            state.addTokensOn(this.cardId, { favor: 2 })
        }

        const wanted = HydratedTrade.wanted(
            state,
            this.playerId,
            this.cardId,
            this.option,
            active,
            matching
        )
        // R-9.3 — favor is component-limited: take as many as possible.
        const favorGained = forFavor ? gainFavorFromBank(state, this.playerId, suit, wanted) : 0
        const secretsGained = forFavor ? 0 : wanted
        player.secrets += secretsGained

        // R-7.4
        const after = runAfter(state, this.playerId, active, particulars)
        notes.push(...after.notes)

        this.metadata = {
            supplySpent: cost,
            matchingAdvisers: matching,
            favorGained,
            secretsGained,
            modifiers: active.length > 0 ? modifierSummary(active) : undefined,
            modifierNotes: notes.length > 0 ? notes : undefined,
            tollsPaid: tollNotes.length > 0 ? tollNotes : undefined
        }
    }

    static matchingAdvisers(
        state: HydratedOathGameState,
        playerId: string,
        cardId: string,
        active: readonly ActiveModifier[] = []
    ): number {
        const suit = suitOf(cardId)
        if (!suit) {
            return 0
        }
        const ctx = (m: ActiveModifier) => ({
            ...modifierContext(state, playerId, m),
            particulars: { cardId }
        })
        // Master of Disguise — "act as if you had another player's advisers instead".
        const sourceId =
            active
                .map((m) => m.hooks.matchingAdvisersOf?.(ctx(m)))
                .find((id) => id !== undefined) ?? playerId
        // Acting Troupe — an adviser read as another suit.
        const overrides = new Map(
            active
                .map((m) => m.hooks.adviserSuitOverride?.(ctx(m)))
                .filter((o): o is { cardId: string; suit: Suit } => !!o)
                .map((o) => [o.cardId, o.suit])
        )
        return advisersOfSuit(state, sourceId, suit, (id) => overrides.get(id) ?? suitOf(id))
    }

    /** R-5.3.2 — favor or secrets the trade asks for, before the favor bank's limit (R-9.3). */
    static wanted(
        state: HydratedOathGameState,
        playerId: string,
        cardId: string,
        option: TradeOption,
        active: readonly ActiveModifier[],
        matching: number
    ): number {
        const forFavor = option === TradeOption.ForFavor
        return foldNumber(
            forFavor ? 'tradeFavor' : 'tradeSecrets',
            forFavor ? 1 + matching : matching,
            state,
            playerId,
            active,
            { cardId, tradeOption: option }
        )
    }

    static plan(
        state: HydratedOathGameState,
        playerId: string,
        cardId: string,
        option: TradeOption,
        modifiers?: readonly ModifierUse[],
        tolls?: readonly string[]
    ): ActionPlan {
        const none: ActionPlan = { cost: TRADE_SUPPLY_COST, active: [] }
        const player = state.getPlayerState(playerId)
        // Master of Disguise trades as the other player's advisers; the modifiers' conditions read it too.
        const disguise = disguisedAs(ActionType.Trade, modifiers)
        const particulars = { cardId, tradeOption: option, advisersOf: disguise }
        const resolved = resolveModifiers(state, playerId, ActionType.Trade, modifiers, particulars)
        if (resolved.reason) return { ...none, reason: resolved.reason }
        const active = resolved.active
        const cost = foldSupplyCost(TRADE_SUPPLY_COST, state, playerId, active, particulars)
        if (player.supply < cost) {
            return { cost, active, reason: `costs ${cost} Supply, player has ${player.supply}` }
        }
        const sites = HydratedTrade.tradeableSitesFor(state, playerId, active)
        if (!sites.some((siteId) => state.isMusterableCard(siteId, cardId))) {
            return {
                cost,
                active,
                reason: `${cardId} is not a denizen at your site`
            }
        }
        // R-7.1.2.a
        const occupied = reasonCannotPlaceOn(state, cardId)
        if (occupied) return { cost, active, reason: occupied }
        if (!suitOf(cardId)) {
            return {
                cost,
                active,
                reason: `${cardId} has no suit, so there is no favor bank to trade with`
            }
        }
        // R-7.1.4 — a persistent "cannot trade with …" (Forest Council).
        const forbidden = reasonPersistentForbidsTrade(state, playerId, cardId)
        if (forbidden) return { cost, active, reason: forbidden }
        // R-7.1.4 — Curfew's "unless they give favor" (`util/tolls.ts`).
        const unpaid = reasonTollsUnpaid(state, playerId, { kind: 'trade', cardId }, tolls)
        if (unpaid) return { cost, active, reason: unpaid }
        if (option === TradeOption.ForFavor && player.secrets < 1) {
            return { cost, active, reason: 'trading for favor requires one secret to place' }
        }
        // R-7.1.4-H1, R-9.2 — Vow of Poverty's "cannot gain favor from Trade"; Master of Disguise trades as the other player's advisers.
        const advisersOf = disguise ?? playerId
        if (
            option === TradeOption.ForFavor &&
            cannotGainFavorFromTrade(state, playerId, advisersOf)
        ) {
            return { cost, active, reason: 'you cannot gain favor from Trade (Vow of Poverty)' }
        }
        if (option === TradeOption.ForSecrets && usableFavor(state, playerId) < 2) {
            return { cost, active, reason: 'trading for secrets requires two favor to place' }
        }
        const unaffordable = reasonCannotPayInAll(state, playerId, [
            modifierPayment(active),
            tollPayment(tolls),
            HydratedTrade.placement(state, option)
        ])
        if (unaffordable) return { cost, active, reason: unaffordable }
        return { cost, active }
    }

    /** R-5.3.2 — what the Trade itself places on the card. */
    private static placement(state: HydratedOathGameState, option: TradeOption) {
        if (option === TradeOption.ForSecrets) return favorPayment(2)
        // R-X.4 — before this revision the placed secret was not totalled, and could leave secrets below zero.
        return secretPayment(
            isAtLeastOathRevision(state, OathRevision.CostsAndFacedownModifiers) ? 1 : 0
        )
    }

    static tradeableSitesFor(
        state: HydratedOathGameState,
        playerId: string,
        active: readonly ActiveModifier[]
    ): string[] {
        const sites = new Set<string>([pawnSiteId(state, playerId)])
        for (const m of active) {
            for (const siteId of m.hooks.tradeSites?.(modifierContext(state, playerId, m)) ?? []) {
                if (state.isSiteFaceup(siteId)) sites.add(siteId)
            }
        }
        return [...sites]
    }

    /** R-5.3, R-7.4 — each card judged as its own trade, with the declared modifiers and the default tolls. */
    static legalCards(
        state: HydratedOathGameState,
        playerId: string,
        modifiers?: readonly ModifierUse[]
    ): string[] {
        const own = pawnSiteId(state, playerId)
        const sites = [own, ...state.faceupSiteIds().filter((siteId) => siteId !== own)]
        return sites.flatMap((siteId) =>
            state.denizensAt(siteId).filter((cardId) => {
                const tolls = defaultTolls(state, playerId, { kind: 'trade', cardId })
                return [TradeOption.ForFavor, TradeOption.ForSecrets].some(
                    (option) =>
                        HydratedTrade.reasonCannotTrade(
                            state,
                            playerId,
                            cardId,
                            option,
                            modifiers,
                            tolls
                        ) === undefined
                )
            })
        )
    }

    static reasonCannotTrade(
        state: HydratedOathGameState,
        playerId: string,
        cardId: string,
        option: TradeOption,
        modifiers?: readonly ModifierUse[],
        tolls?: readonly string[]
    ): string | undefined {
        return HydratedTrade.plan(state, playerId, cardId, option, modifiers, tolls).reason
    }

    static canDoTrade(state: HydratedOathGameState, playerId: string): boolean {
        return state.denizensAt(pawnSiteId(state, playerId)).some((cardId) => {
            const tolls = defaultTolls(state, playerId, { kind: 'trade', cardId })
            return (
                HydratedTrade.reasonCannotTrade(
                    state,
                    playerId,
                    cardId,
                    TradeOption.ForFavor,
                    undefined,
                    tolls
                ) === undefined ||
                HydratedTrade.reasonCannotTrade(
                    state,
                    playerId,
                    cardId,
                    TradeOption.ForSecrets,
                    undefined,
                    tolls
                ) === undefined
            )
        })
    }
}
