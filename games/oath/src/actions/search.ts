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
import { CardKind, Region } from '../model/oathEnums.js'
import {
    DISCARD_SEARCH_SUPPLY_COST,
    visionsDrawnAfter,
    worldDeckSearchCost
} from '../data/visionsDrawnTrack.js'
import { sitePowerCategory } from '../data/sites.js'
import { kindOf } from '../data/cardRegistry.js'
import { topBackType } from '../model/vault.js'
import { drawDiscardPile, drawWorldDeck } from '../util/knowledge.js'
import { payTolls, reasonTollsUnpaid } from '../util/tolls.js'
import { defaultTolls } from '../util/tollDefaults.js'
import {
    firstForbid,
    foldNumber,
    modifierContext,
    modifierSummary,
    ModifierUse,
    ModifierUses,
    payModifierCosts,
    resolveModifiers,
    type ActiveModifier,
    type ActionPlan
} from '../util/modifiers.js'
import { pawnSiteId, regionOfPawn } from '../powers/vocabulary.js'

/** R-5.1.2 — before any modifier. */
export const SEARCH_DRAW_COUNT = 3

export enum SearchSource {
    WorldDeck = 'worldDeck',
    Discard = 'discard'
}

export type SearchDraw = Type.Static<typeof SearchDraw>
export const SearchDraw = Type.Object({
    /** R-5.1.2, R-9.3 — in draw order. */
    drawnCardIds: Type.Array(Type.String()),
    /** R-5.1.2 */
    stoppedOnVision: Type.Boolean(),
    /** R-9.4 — absent when empty. */
    topCardBackType: Type.Optional(Type.Enum(CardKind)),
    /** R-9.4 — the count stays private. */
    worldDeckExhausted: Type.Boolean(),
    discardTopBackType: Type.Optional(Type.Union([Type.Enum(CardKind), Type.Null()])),
    /** R-5.1.2 */
    discardRegion: Type.Optional(Type.Enum(Region))
})

export type SearchMetadata = Type.Static<typeof SearchMetadata>
export const SearchMetadata = Type.Object({
    /** R-9.4 */
    draw: Visibility.protect(SearchDraw, { policy: Visibility.Policy.Actor }),
    supplySpent: Type.Number(),
    cardsDrawn: Type.Number(),
    visionsDrawn: Type.Number(),
    /** Truthful Harp */
    revealedDraw: Type.Optional(Type.Array(Type.String())),
    /** R-7.4 */
    modifiers: Type.Optional(Type.Array(Type.String())),
    /** R-7.1.4 (Forced Labor) */
    tollsPaid: Type.Optional(Type.Array(Type.String()))
})

export type Search = Type.Static<typeof Search>
export const Search = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.Search),
            playerId: Type.String(),
            drawFrom: Type.Enum(SearchSource),
            revealsInfo: Type.Literal(true),
            /** R-7.4 — declared at the start of the action. */
            modifiers: ModifierUses,
            /** R-7.1.4 (Forced Labor) */
            tolls: Type.Optional(Type.Array(Type.String(), { maxItems: 8 })),
            metadata: Type.Optional(SearchMetadata)
        })
    ])
)

export const SearchValidator = Compile(Search)

export function isSearch(action?: GameAction): action is Search {
    return action?.type === ActionType.Search
}

export class HydratedSearch extends HydratableAction<typeof Search> implements Search {
    declare type: ActionType.Search
    declare playerId: string
    declare drawFrom: SearchSource
    declare revealsInfo: true
    declare modifiers?: ModifierUse[]
    declare tolls?: string[]
    declare metadata?: SearchMetadata

    constructor(data: Search) {
        super(data, SearchValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        const plan = HydratedSearch.plan(
            state,
            this.playerId,
            this.drawFrom,
            this.modifiers,
            this.tolls
        )
        if (plan.reason) {
            throw Error(`Cannot search: ${plan.reason}`)
        }
        const draw = this.drawFromVault(state)
        const { cost, active } = plan

        // R-7.1.2, R-7.4 — paid at declaration.
        payModifierCosts(state, this.playerId, active)
        // R-7.1.4 (Forced Labor)
        const tollNotes = payTolls(state, this.playerId, { kind: 'search' }, this.tolls)

        // R-5.1.1
        player.spendSupply(cost)

        const drawn = draw.drawnCardIds
        player.setHand([...player.knownHand(), ...drawn])
        // Truthful Harp — the draw is revealed, so the whole hand is the table's to see.
        if (active.some((m) => m.hooks.revealsDraw)) player.handShown = true

        if (this.drawFrom === SearchSource.WorldDeck) {
            state.topCardBackType = draw.topCardBackType
            state.worldDeckExhausted = draw.worldDeckExhausted
            // R-2.7.1, R-5.1.2 — one space, since the draw stops on the first Vision.
            if (draw.stoppedOnVision) {
                state.visionsDrawn = visionsDrawnAfter(state.visionsDrawn, 1)
            }
        } else {
            // R-9.4 — the pile's fronts stay in the vault; its count and top back are public.
            const region = draw.discardRegion
            const topBack = draw.discardTopBackType
            assertExists(region, 'A discard Search records its pile')
            assert(topBack !== undefined, 'A discard Search records the back left on its pile')
            state.discardPileCounts[region] -= drawn.length

            const next = { ...state.discardTopBackType }
            if (topBack === null) delete next[region]
            else next[region] = topBack
            state.discardTopBackType = next
        }

        // R-7.4, R-5.1.4 — carried to the play, which clears them.
        state.pendingSearchModifiers = active
            .filter(
                (m) =>
                    m.hooks.after !== undefined ||
                    m.hooks.discardTo !== undefined ||
                    m.hooks.discardFirstAtSitePlay === true ||
                    m.hooks.sitePlayGainsSecret === true ||
                    m.hooks.playAnywhere !== undefined ||
                    m.hooks.secondPlay === true ||
                    m.hooks.revealsDraw === true
            )
            .map((m) => ({
                cardId: m.power.cardId,
                powerIndex: m.power.powerIndex,
                choices: m.choices.length > 0 ? [...m.choices] : undefined
            }))
        if (state.pendingSearchModifiers.length === 0) state.pendingSearchModifiers = undefined

        this.metadata = {
            draw,
            revealedDraw: active.some((m) => m.hooks.revealsDraw) ? [...drawn] : undefined,
            supplySpent: cost,
            cardsDrawn: drawn.length,
            visionsDrawn: state.visionsDrawn,
            modifiers: active.length > 0 ? modifierSummary(active) : undefined,
            tollsPaid: tollNotes.length > 0 ? tollNotes : undefined
        }
    }

    private drawFromVault(state: HydratedOathGameState): SearchDraw {
        const vault = state.requireVault()
        const count = HydratedSearch.drawCount(state, this.playerId, this.modifiers, this.drawFrom)
        if (this.drawFrom === SearchSource.WorldDeck) {
            const {
                drawn,
                stoppedOnVision,
                topBackType: nextBack
            } = drawWorldDeck(state, count, this.playerId)
            return {
                drawnCardIds: drawn,
                stoppedOnVision,
                topCardBackType: nextBack,
                worldDeckExhausted: vault.worldDeck.length === 0
            }
        }
        const region = HydratedSearch.drawRegion(state, this.playerId, this.modifiers)
        const drawnCardIds = drawDiscardPile(
            state,
            region,
            count,
            HydratedSearch.drawsFromBottom(state, this.playerId, this.modifiers),
            this.playerId
        )
        const newTop = vault.discardPiles[region][0]
        return {
            drawnCardIds,
            stoppedOnVision: false,
            topCardBackType: topBackType(vault),
            worldDeckExhausted: vault.worldDeck.length === 0,
            discardRegion: region,
            discardTopBackType: newTop === undefined ? null : HydratedSearch.backOf(newTop)
        }
    }

    private static backOf(cardId: string): CardKind {
        const kind = kindOf(cardId)
        assertExists(kind, `${cardId} is not a registered card`)
        return kind
    }

    /** R-5.1.1 */
    static supplyCost(state: HydratedOathGameState, source: SearchSource): number {
        return source === SearchSource.WorldDeck
            ? worldDeckSearchCost(state.visionsDrawn)
            : DISCARD_SEARCH_SUPPLY_COST
    }

    static drawRegion(
        state: HydratedOathGameState,
        playerId: string,
        modifiers?: readonly ModifierUse[]
    ): Region {
        const region = regionOfPawn(state, playerId)
        // R-7.4 — a modifier may name another pile (Errand Boy, Observatory).
        const resolved = resolveModifiers(state, playerId, ActionType.Search, modifiers, {
            drawFrom: SearchSource.Discard
        })
        if (resolved.reason) return region
        return HydratedSearch.drawRegionFor(state, playerId, resolved.active) ?? region
    }

    /** Mushrooms */
    static drawsFromBottom(
        state: HydratedOathGameState,
        playerId: string,
        modifiers?: readonly ModifierUse[]
    ): boolean {
        const resolved = resolveModifiers(state, playerId, ActionType.Search, modifiers, {
            drawFrom: SearchSource.Discard
        })
        return !resolved.reason && resolved.active.some((m) => m.hooks.drawsFromBottom)
    }

    static drawRegionFor(
        state: HydratedOathGameState,
        playerId: string,
        active: readonly ActiveModifier[]
    ): Region | undefined {
        for (const m of active) {
            const other = m.hooks.drawRegion?.({
                ...modifierContext(state, playerId, m),
                particulars: { drawFrom: SearchSource.Discard }
            })
            if (other) return other
        }
        return undefined
    }

    static drawCount(
        state: HydratedOathGameState,
        playerId: string,
        modifiers?: readonly ModifierUse[],
        source?: SearchSource
    ): number {
        const category = sitePowerCategory(state.siteCardAt(pawnSiteId(state, playerId)))
        const base = category === 'marshes' ? SEARCH_DRAW_COUNT - 1 : SEARCH_DRAW_COUNT
        const particulars = source ? { drawFrom: source } : {}
        const resolved = resolveModifiers(
            state,
            playerId,
            ActionType.Search,
            modifiers,
            particulars
        )
        if (resolved.reason) return base
        return foldNumber('drawCount', base, state, playerId, resolved.active, particulars)
    }

    static plan(
        state: HydratedOathGameState,
        playerId: string,
        source: SearchSource,
        modifiers?: readonly ModifierUse[],
        tolls?: readonly string[]
    ): ActionPlan {
        const base = HydratedSearch.supplyCost(state, source)
        const none: ActionPlan = { cost: base, active: [] }
        const player = state.getPlayerState(playerId)
        const particulars = { drawFrom: source }
        const resolved = resolveModifiers(
            state,
            playerId,
            ActionType.Search,
            modifiers,
            particulars
        )
        if (resolved.reason) return { ...none, reason: resolved.reason }
        const active = resolved.active
        const cost = foldNumber('supplyCost', base, state, playerId, active, particulars)
        // R-6.6.2.a — Greedy's "cannot search if you would spend more than 2".
        const forbidden = firstForbid(state, playerId, active, { ...particulars, supplyCost: cost })
        if (forbidden) return { cost, active, reason: forbidden }
        // R-7.1.4 — Forced Labor's "unless they give favor" (`util/tolls.ts`).
        const unpaid = reasonTollsUnpaid(state, playerId, { kind: 'search' }, tolls)
        if (unpaid) return { cost, active, reason: unpaid }
        if (player.supply < cost) {
            return { cost, active, reason: `costs ${cost} Supply, player has ${player.supply}` }
        }

        if (source === SearchSource.WorldDeck) {
            if (state.worldDeckExhausted) {
                return { cost, active, reason: 'the world deck is empty' }
            }
        } else {
            const pile = HydratedSearch.drawRegion(state, playerId, modifiers)
            if (state.discardPileCounts[pile] === 0) {
                return { cost, active, reason: `the ${pile} discard pile is empty` }
            }
        }

        return { cost, active }
    }

    static reasonCannotSearch(
        state: HydratedOathGameState,
        playerId: string,
        source: SearchSource,
        modifiers?: readonly ModifierUse[],
        tolls?: readonly string[]
    ): string | undefined {
        return HydratedSearch.plan(state, playerId, source, modifiers, tolls).reason
    }

    /** R-5.1.1, R-7.4 — judged with the modifiers the player has declared. */
    static legalSources(
        state: HydratedOathGameState,
        playerId: string,
        modifiers?: readonly ModifierUse[]
    ): SearchSource[] {
        const tolls = defaultTolls(state, playerId, { kind: 'search' })
        return Object.values(SearchSource).filter(
            (source) =>
                HydratedSearch.reasonCannotSearch(state, playerId, source, modifiers, tolls) ===
                undefined
        )
    }

    static canDoSearch(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedSearch.legalSources(state, playerId).length > 0
    }
}
