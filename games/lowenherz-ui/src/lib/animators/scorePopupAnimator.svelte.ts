import { gsap } from 'gsap'
import { tick } from 'svelte'
import type { GameAction } from '@tabletop/common'
import {
    type ExpandRegion,
    type HydratedLowenherzGameState,
    isExpandRegion,
    isPlaceWall,
    type Region,
    squareKey,
    type Wall
} from '@tabletop/lowenherz'
import { expansionActionsFor } from '$lib/model/expansionRun.js'
import { scaled } from '$lib/model/boardMetrics.js'
import { StateAnimator, type StateChange } from './stateAnimator.js'

/**
 * Floating "+N" near wherever a wall just completed a region, in its owner's colour (or slate for
 * an unowned one) - or, for a knight's expansion, near the second of its two spaces once both have
 * landed, totalling both. A single, standalone expansion stays silent.
 *
 * The pill plays on the scoring action's own timeline, so system actions applied in the same batch
 * wait for it. The session publishes the new walls and tint only after the whole batch, so the
 * board shows them from `scoredBoard` meanwhile: a pill must not precede what it annotates.
 */
type Popup = { id: string; col: number; row: number; text: string; color: string }
type ScoreEntry = { anchorKey: string; amount: number; color: string }
export type ScoredBoard = { walls: Wall[]; regions: Region[] }

// Bounce in, sit, then rise away - the shape bus-ui uses for placing a passenger and sol-ui for
// constructing a building, down to the overshoot scale and eases (see bus-ui's
// addPassengersPlacementAnimator: INITIAL_SCALE, POP_OVERSHOOT_SCALE, pop then settle).
//
// The bounce is two tweens rather than one. A single `back.out` tween into scale 1 does overshoot,
// but slightly and implicitly; popping deliberately past rest and then relaxing is what reads as a
// bounce.
const INITIAL_SCALE = 0.2
const OVERSHOOT_SCALE = 1.16
const POP = 0.09
const SETTLE = 0.08
const SIT = 0.5
const RISE = 0.25

export class ScorePopupAnimator extends StateAnimator {
    popups: Popup[] = $state([])

    // Ahead of the published state from a scoring action until the session publishes again.
    scoredBoard: ScoredBoard | undefined = $derived(this.untilPublished(this.gameSession.gameState))

    private nodes = new Map<string, HTMLElement>()
    private sequence = 0
    private stopWatchingSilentRestores: (() => void) | undefined

    setNode(id: string, element?: HTMLElement) {
        if (element) this.nodes.set(id, element)
        else this.nodes.delete(id)
    }

    private untilPublished(_published: HydratedLowenherzGameState): ScoredBoard | undefined {
        return undefined
    }

    private clear() {
        this.popups = []
    }

    private popupFor(entry: ScoreEntry): Popup {
        const [col, row] = entry.anchorKey.split(',').map(Number)
        const text = entry.amount > 0 ? `+${entry.amount}` : `${entry.amount}`
        return { id: `popup-${++this.sequence}`, col, row, text, color: entry.color }
    }

    private collectPlaceWallEntries(action: GameAction): ScoreEntry[] {
        const entries: ScoreEntry[] = []
        if (!isPlaceWall(action)) return entries

        for (const region of action.metadata?.completedRegions ?? []) {
            if (region.points === 0) continue
            // Slate rather than the gray prince's #888888 - an unowned region's popup shouldn't
            // read as that player's (see NEUTRAL_ZONE_PAINT).
            const color = region.owner ? this.gameSession.uiColorForOwner(region.owner) : '#3f3f46'
            entries.push({ anchorKey: region.anchorSquareKey, amount: region.points, color })
        }

        return entries
    }

    // The expansion actions recorded up to and including this one, which is the chain itself.
    private expansionChainThrough(action: ExpandRegion): ExpandRegion[] {
        const earlier = this.gameSession.actions.filter(
            (candidate) =>
                candidate.index !== undefined &&
                action.index !== undefined &&
                candidate.index < action.index
        )
        return expansionActionsFor([...earlier, action], action.regionId, action.playerId)
    }

    // Anchored on the closing action's own square: the pill lands where the move just finished.
    private collectExpandRegionEntry(
        action: GameAction,
        from: StateChange['from'],
        to: StateChange['to']
    ): ScoreEntry | undefined {
        if (!isExpandRegion(action)) return undefined
        const continuesChain = from?.expandingRegionId === action.regionId
        const closesChain = to.expandingRegionId === undefined
        if (!continuesChain || !closesChain) return undefined

        const chain = this.expansionChainThrough(action)
        if (chain.length <= 1) return undefined

        const amount = chain.reduce((sum, step) => sum + (step.metadata?.pointsGained ?? 0), 0)
        if (amount === 0) return undefined

        const color = this.gameSession.colors.getPlayerUiColor(action.playerId)
        return { anchorKey: squareKey(action.space.col, action.space.row), amount, color }
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        if (!action) return

        const entries = this.collectPlaceWallEntries(action)
        const expandEntry = this.collectExpandRegionEntry(action, from, to)
        if (expandEntry) entries.push(expandEntry)

        if (entries.length > 0 || this.scoredBoard) {
            this.scoredBoard = { walls: to.board.walls, regions: to.regions }
        }
        if (entries.length === 0) return

        // Fold entries that land on the same square into one pill rather than stacking two at
        // the same spot - a single wall can complete more than one region.
        const bySquare = new Map<string, ScoreEntry>()
        for (const entry of entries) {
            const existing = bySquare.get(entry.anchorKey)
            if (existing) existing.amount += entry.amount
            else bySquare.set(entry.anchorKey, { ...entry })
        }

        this.popups = Array.from(bySquare.values())
            .filter((entry) => entry.amount !== 0)
            .map((entry) => this.popupFor(entry))
        await tick()

        const timeline = animationContext.actionTimeline
        for (const popup of this.popups) {
            const node = this.nodes.get(popup.id)
            if (!node) continue
            gsap.set(node, { xPercent: -50, yPercent: -50, scale: INITIAL_SCALE, opacity: 0 })
            timeline.to(
                node,
                { scale: OVERSHOOT_SCALE, opacity: 1, duration: POP, ease: 'back.out(2.2)' },
                0
            )
            timeline.to(node, { scale: 1, duration: SETTLE, ease: 'power2.out' }, POP)
            timeline.to(
                node,
                { y: -scaled(32), opacity: 0, duration: RISE, ease: 'power1.out' },
                POP + SETTLE + SIT
            )
        }

        animationContext.afterAnimations(() => this.clear())
    }

    override onAttach() {
        this.stopWatchingSilentRestores = this.gameSession.onSilentRestore(() => this.clear())
    }

    override onDetach() {
        this.stopWatchingSilentRestores?.()
        this.stopWatchingSilentRestores = undefined
        this.clear()
        this.scoredBoard = undefined
    }
}
