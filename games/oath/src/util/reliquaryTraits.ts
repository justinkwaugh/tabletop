import { assertExists } from '@tabletop/common'
import { regionOfPawn } from './pawn.js'
import { gainFavorFromBank } from './favor.js'
import { cannotGainFavorFromTrade } from './continuous.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PlayerStatus, Region } from '../model/oathEnums.js'
import { NO_COST, PowerTiming, type CardPower } from '../data/cardPowers.js'
import { RELIQUARY_MODIFIERS, type ReliquaryModifier } from '../data/reliquary.js'
import { suitOf } from '../data/cardRegistry.js'
import { RELIQUARY_SPACES, reliquarySlot } from './imperial.js'
import { reliquarySlotId } from './setup.js'
import type { EffectContext, ModifierHooks } from '../powers/registry.js'
import type { ActiveModifier } from './modifiers.js'

export function uncoveredTraits(
    state: HydratedOathGameState,
    playerId: string
): ReliquaryModifier[] {
    const player = state.getPlayerState(playerId)
    if (player.status !== PlayerStatus.Chancellor) return []
    const traits: ReliquaryModifier[] = []
    for (let i = 0; i < RELIQUARY_SPACES; i++) {
        const trait = RELIQUARY_MODIFIERS[i]
        if (trait && reliquarySlot(state, reliquarySlotId(i)) === undefined) traits.push(trait)
    }
    return traits
}

export function hasTrait(state: HydratedOathGameState, playerId: string, traitId: string): boolean {
    return uncoveredTraits(state, playerId).some((t) => t.id === traitId)
}

export const BRUTAL = 'reliquary.brutal'
export const DECADENT = 'reliquary.decadent'
export const CARELESS = 'reliquary.careless'
export const GREEDY = 'reliquary.greedy'

/** Greedy — "you cannot search if you would spend more than 2 Supply". */
export const GREEDY_SUPPLY_LIMIT = 2

const TRAIT_HOOKS: Record<string, { action: ActionType; hooks: ModifierHooks }> = {
    [DECADENT]: {
        action: ActionType.Travel,
        hooks: {
            spendsNoSupply: (ctx) =>
                travelRegion(ctx) === Region.Cradle &&
                regionOfPawn(ctx.state, ctx.playerId) !== Region.Cradle,
            supplyCost: (base, ctx) => (travelRegion(ctx) === Region.Hinterland ? base + 1 : base)
        }
    },
    [CARELESS]: {
        action: ActionType.Trade,
        hooks: {
            tradeFavor: (base) => base + 1,
            tradeSecrets: (base) => Math.max(0, base - 1),
            // Careless' "(even when trading for secrets)": a secrets trade has no favor to fold into.
            before: (ctx) => {
                // Spelt out: `actions/trade.ts` imports this file through the modifier framework.
                if (ctx.particulars?.tradeOption !== 'forSecrets') return undefined
                return gainOneFavor(ctx)
            }
        }
    },
    [GREEDY]: {
        action: ActionType.Search,
        hooks: {
            drawCount: (base) => base + 2,
            forbids: (ctx) => {
                const cost = ctx.particulars?.supplyCost
                if (cost !== undefined && cost > GREEDY_SUPPLY_LIMIT) {
                    return `Greedy: cannot search when it would spend ${cost} Supply, more than ${GREEDY_SUPPLY_LIMIT}`
                }
                return undefined
            }
        }
    },
    // R-5.5.6 — Brutal applies at the sacrifice, which asks `hasTrait` directly.
    [BRUTAL]: {
        action: ActionType.Campaign,
        hooks: {}
    }
}

function travelRegion(ctx: EffectContext): Region {
    const destination = ctx.particulars?.destinationSiteId
    assertExists(destination, 'a Travel always names a destination')
    return ctx.state.regionOf(destination)
}

/**
 * R-7.1.4-H1, R-9.2 — Vow of Poverty's "You cannot gain favor from Trade" reaches a Trade for secrets:
 * its Q&A withholds Careless's favor, so that Trade gains none and Secret Signal's "only one" is not met.
 * `advisersOf` is whose advisers the Trade acts with (Master of Disguise). From revision 5 (R-X.4).
 */
export function reasonTradeForSecretsGainsNoFavor(
    state: HydratedOathGameState,
    playerId: string,
    advisersOf: string | undefined
): string | undefined {
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes2)) return undefined
    return cannotGainFavorFromTrade(state, playerId, advisersOf)
        ? 'you cannot gain favor from Trade (Vow of Poverty)'
        : undefined
}

function gainOneFavor(ctx: EffectContext): string | undefined {
    const cardId = ctx.particulars?.cardId
    const suit = cardId ? suitOf(cardId) : undefined
    if (!suit) return undefined
    const withheld = reasonTradeForSecretsGainsNoFavor(
        ctx.state,
        ctx.playerId,
        ctx.particulars?.advisersOf
    )
    if (withheld) return `Careless: ${withheld}`
    const gained = gainFavorFromBank(ctx.state, ctx.playerId, suit, 1)
    return gained > 0 ? 'Careless: gained 1 favor' : 'Careless: the bank had no favor to give'
}

export function traitModifiers(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType
): ActiveModifier[] {
    const found: ActiveModifier[] = []
    for (const trait of uncoveredTraits(state, playerId)) {
        const entry = TRAIT_HOOKS[trait.id]
        if (!entry || entry.action !== action) continue
        const power: CardPower = {
            cardId: trait.id,
            powerIndex: 0,
            timing: PowerTiming.Modifier,
            text: trait.powerText,
            cost: NO_COST,
            modifiesAction: action
        }
        found.push({ power, hooks: entry.hooks, choices: [], mandatory: true })
    }
    return found
}
