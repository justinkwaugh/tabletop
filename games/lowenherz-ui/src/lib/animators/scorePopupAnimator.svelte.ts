import { gsap } from 'gsap'
import { tick } from 'svelte'
import type { Color, GameAction } from '@tabletop/common'
import { isExpandRegion, isPlaceWall, squareKey } from '@tabletop/lowenherz'
import { scaled } from '$lib/model/boardMetrics.js'
import { StateAnimator, type StateChange } from './stateAnimator.js'

/**
 * Floating "+N" near wherever a wall just completed a region, in its owner's colour (or slate for
 * an unowned one) - or, for a knight's expansion, near the second of its two spaces once both have
 * landed, totalling both. A single, standalone expansion (no second space to wait for) stays
 * silent, matching the "no popup" default this used to be for every ExpandRegion: this is
 * specifically about not making a player watch two separate pills for one continuous move, not
 * about giving expansion its own popup back generally.
 *
 * The pop/settle/sit/rise sequence runs off the shared timeline, from afterAnimations - a pill
 * must not precede what it annotates, and the session assigns the new state (the walls, the
 * newly-tinted squares) only after the shared timeline finishes. Starting here instead means the
 * wall is already down by the time the pill's first frame paints. The tradeoff: this is no longer
 * on gameSession.busy, so the game accepts the next action while a pill is still bouncing/rising -
 * accepted deliberately, in favor of the pill never again reading as older than the board.
 */
type Popup = { id: string; col: number; row: number; text: string; color: string }
type ScoreEntry = { anchorKey: string; amount: number; color: string }

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

    private nodes = new Map<string, HTMLElement>()
    private sequence = 0
    // The non-blocking pop/settle/sit/rise timeline per live popup id, so a component teardown
    // mid-flight has something concrete to kill (see onDetach).
    private tails = new Map<string, gsap.core.Timeline>()

    // Each still-relevant expansion's own pointsGained, held rather than shown while
    // state.expandingRegionId stays set (the engine's own "this player could still spend a second
    // sword on this region" signal) - a stack, not a running total, specifically so Undo can pop
    // exactly one step back rather than discarding the whole chain's progress: each expansion
    // space is deliberately its own action so Undo reverts exactly one of them at a time (see
    // expandRegion.ts's own comment), and this mirrors that one-step-at-a-time granularity rather
    // than forcing a player who undoes the second space to re-earn credit for the first. Left in
    // place once a chain closes and shows its pill (not cleared) for the same reason - undoing
    // that very closing action needs the first expansion's contribution still sitting here to
    // recall, not gone.
    private chainSteps: number[] = []

    setNode(id: string, element?: HTMLElement) {
        if (element) this.nodes.set(id, element)
        else this.nodes.delete(id)
    }

    private add(anchorKey: string, amount: number, color: string): string | undefined {
        if (amount === 0) return undefined
        const [col, row] = anchorKey.split(',').map(Number)
        // A plain counter, not Date.now()/Math.random(): this id only keys the each block, and a
        // monotonic one cannot collide when one action scores several times.
        const id = `popup-${++this.sequence}`
        this.popups = [
            ...this.popups,
            { id, col, row, text: amount > 0 ? `+${amount}` : `${amount}`, color }
        ]
        return id
    }

    private collectPlaceWallEntries(action: GameAction): ScoreEntry[] {
        const entries: ScoreEntry[] = []
        if (!isPlaceWall(action)) return entries

        for (const region of action.metadata?.completedRegions ?? []) {
            if (region.points === 0) continue
            // Slate rather than the gray prince's #888888 - an unowned region's popup shouldn't
            // read as that player's (see NEUTRAL_ZONE_PAINT).
            const color = region.ownerColor
                ? this.gameSession.uiColorForBoardColor(region.ownerColor)
                : '#3f3f46'
            entries.push({ anchorKey: region.anchorSquareKey, amount: region.points, color })
        }

        return entries
    }

    // Anchored on THIS action's own square, not the first expansion's - "bounces onto the second
    // expansion square" is the point: the pill lands where the move just finished, not where it
    // started.
    private collectExpandRegionEntry(action: GameAction, from: StateChange['from'], to: StateChange['to']): ScoreEntry | undefined {
        if (!isExpandRegion(action)) {
            // Only clear when THIS action is the one that closed an open chain (declining the
            // second space via placing a knight instead, or passing) - the declined expansion
            // stays wordless, same as a standalone one. Checking to.expandingRegionId alone,
            // without also requiring it to have been open in `from`, cleared this on ANY later
            // action once a chain had already closed - including the engine's own follow-up
            // bookkeeping right after a chain finishes normally - wiping the steps before a
            // player even had a chance to undo back into them.
            if (from?.expandingRegionId !== undefined && to.expandingRegionId === undefined) {
                this.chainSteps = []
            }
            return undefined
        }

        // A fresh start (the chain wasn't open going into this action) discards any steps left
        // over from a PREVIOUS, already-shown chain before tracking this one - otherwise an old
        // total could leak into an unrelated later expansion.
        if (!from || from.expandingRegionId === undefined) {
            this.chainSteps = []
        }

        this.chainSteps.push(action.metadata?.pointsGained ?? 0)

        if (to.expandingRegionId !== undefined) return undefined // more may follow - hold silently

        if (this.chainSteps.length <= 1) {
            this.chainSteps = [] // standalone expansion - nothing to show, nothing to keep
            return undefined
        }

        const amount = this.chainSteps.reduce((sum, points) => sum + points, 0)
        if (amount === 0) {
            this.chainSteps = []
            return undefined
        }

        // Left in place (see the field's own comment) rather than cleared here - only an
        // unrelated fresh start, or a full actionless reset below, clears it.
        const color = this.gameSession.colors.getPlayerUiColor(action.playerId)
        return { anchorKey: squareKey(action.space.col, action.space.row), amount, color }
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        if (!action) {
            if (to.expandingRegionId !== undefined) {
                // Landed mid-chain - undoing exactly the expansion that closed it, say. Undo
                // always reverts exactly one action, so pop exactly one step's worth rather
                // than discarding the whole chain: an earlier step still sitting here is still
                // valid, and needs to still count once whatever eventually closes the chain
                // next fires.
                this.chainSteps.pop()
            } else {
                this.chainSteps = []
            }
            return
        }

        const entries = this.collectPlaceWallEntries(action)
        const expandEntry = this.collectExpandRegionEntry(action, from, to)
        if (expandEntry) entries.push(expandEntry)
        if (entries.length === 0) return

        // Fold entries that land on the same square into one pill rather than stacking two at
        // the same spot - cheap insurance, since a single wall can complete more than one region.
        const bySquare = new Map<string, ScoreEntry>()
        for (const entry of entries) {
            const existing = bySquare.get(entry.anchorKey)
            if (existing) existing.amount += entry.amount
            else bySquare.set(entry.anchorKey, { ...entry })
        }

        const ids = Array.from(bySquare.values())
            .map((entry) => (entry.amount !== 0 ? this.add(entry.anchorKey, entry.amount, entry.color) : undefined))
            .filter((id): id is string => !!id)
        if (ids.length === 0) return

        await tick()

        animationContext.afterAnimations(() => {
            for (const id of ids) {
                const node = this.nodes.get(id)
                if (!node) {
                    this.popups = this.popups.filter((popup) => popup.id !== id)
                    continue
                }
                // Set right as this runs, not earlier - the node has been mounted since the
                // tick() above, but its first VISIBLE frame should be the one the board's new
                // walls/tint also land on, not one that arrived while the old state was still
                // showing. xPercent/yPercent centre it on its anchor and compose with the y tween
                // below, so gsap owns the whole transform.
                gsap.set(node, { xPercent: -50, yPercent: -50, scale: INITIAL_SCALE, opacity: 0 })
                const tail = gsap.timeline()
                tail.to(node, { scale: OVERSHOOT_SCALE, opacity: 1, duration: POP, ease: 'back.out(2.2)' }, 0)
                tail.to(node, { scale: 1, duration: SETTLE, ease: 'power2.out' }, POP)
                tail.to(
                    node,
                    {
                        y: -scaled(32),
                        opacity: 0,
                        duration: RISE,
                        ease: 'power1.out',
                        onComplete: () => {
                            this.popups = this.popups.filter((popup) => popup.id !== id)
                            this.tails.delete(id)
                        }
                    },
                    POP + SETTLE + SIT
                )
                this.tails.set(id, tail)
            }
        })
    }

    override onDetach() {
        for (const tail of this.tails.values()) tail.kill()
        this.tails.clear()
        this.popups = []
        this.chainSteps = []
    }
}
