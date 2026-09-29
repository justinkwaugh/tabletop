import { assertExists } from '@tabletop/common'
import { regionOfPawn } from './pawn.js'
import { gainFavorFromBank } from './favor.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PlayerStatus, Region } from '../model/oathEnums.js'
import { NO_COST, PowerTiming, type CardPower } from '../data/cardPowers.js'
import { RELIQUARY_MODIFIERS, type ReliquaryModifier } from '../data/reliquary.js'
import { suitOf } from '../data/cardRegistry.js'
import { RELIQUARY_SPACES, reliquarySlot } from './imperial.js'
import { reliquarySlotId } from '../model/setup.js'
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
            supplyCost: (base, ctx) => {
                const { state, playerId } = ctx
                const destination = ctx.particulars?.destinationSiteId
                assertExists(destination, 'a Travel always names a destination')
                const from = regionOfPawn(state, playerId)
                const to = state.regionOf(destination)
                if (to === Region.Cradle && from !== Region.Cradle) return 0
                if (to === Region.Hinterland) return base + 1
                return base
            }
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

function gainOneFavor(ctx: EffectContext): string | undefined {
    const cardId = ctx.particulars?.cardId
    const suit = cardId ? suitOf(cardId) : undefined
    if (!suit) return undefined
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
