import { gsap } from 'gsap'
import { tick } from 'svelte'
import type { Color, GameAction } from '@tabletop/common'
import { isExpandRegion, isPlaceWall, squareKey } from '@tabletop/lowenherz'
import { scaled } from '$lib/model/boardMetrics.js'
import { StateAnimator, type StateChange } from './stateAnimator.js'

/**
 * Floating "+N"/"-N" near wherever a region was just created, expanded, invaded or shrunk - one per
 * scoring event, in the affected player's colour. Anchors and amounts come from PlaceWall's and
 * ExpandRegion's metadata as they were applied, so nothing here diffs state.
 *
 * The whole sequence runs on the popup's own timeline, started from `afterAnimations` - the one
 * animator here that keeps its motion off the shared one. It is deliberate, for two reasons.
 *
 * A pill must not precede what it annotates. The session assigns state only after the shared
 * timeline finishes, so anything placed there plays while the board still shows the state BEFORE the
 * action: "+3" would bounce over a region that has not filled yet, beside a wall that has not
 * appeared yet. Starting in afterAnimations puts the pill's first frame in the same drain as the
 * state assignment, so the fill, the wall and the pill all arrive together.
 *
 * The framework's other answer would be Pattern B - render the action's result transiently and
 * animate that. For a piece being placed that is right, and it is what bus-ui does. Here it would
 * mean transiently drawing the wall and every newly-tinted square purely so a label could lead them
 * by a third of a second, which buys nothing.
 *
 * It also keeps the board responsive: the shared timeline holds the state update, and a wall that
 * completes three regions scores three times.
 */
type Popup = { id: string; col: number; row: number; text: string; color: string }

// Bounce in, sit, then rise away - the shape bus-ui uses for placing a passenger and sol-ui for
// constructing a building, down to the overshoot scale and eases (see bus-ui's
// addPassengersPlacementAnimator: INITIAL_SCALE, POP_OVERSHOOT_SCALE, pop then settle).
//
// The bounce is two tweens rather than one. A single `back.out` tween into scale 1 does overshoot,
// but slightly and implicitly; popping deliberately past rest and then relaxing is what reads as a
// bounce.
const INITIAL_SCALE = 0.2
const OVERSHOOT_SCALE = 1.16
const POP = 0.18
const SETTLE = 0.16
const SIT = 1.0
const RISE = 0.5

export class ScorePopupAnimator extends StateAnimator {
    popups: Popup[] = $state([])

    private nodes = new Map<string, HTMLElement>()
    private sequence = 0

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

    private addForCompletedRegions(
        regions: { ownerColor?: Color; points: number; anchorSquareKey: string }[] | undefined,
        ids: (string | undefined)[]
    ) {
        for (const region of regions ?? []) {
            // Slate rather than the gray prince's #888888 - an unowned region's popup shouldn't
            // read as that player's (see NEUTRAL_ZONE_PAINT).
            const color = region.ownerColor
                ? this.gameSession.colors.getUiColor(region.ownerColor)
                : '#3f3f46'
            ids.push(this.add(region.anchorSquareKey, region.points, color))
        }
    }

    private collect(action: GameAction, to: StateChange['to']): (string | undefined)[] {
        const ids: (string | undefined)[] = []

        if (isPlaceWall(action)) {
            this.addForCompletedRegions(action.metadata?.completedRegions, ids)
        } else if (isExpandRegion(action)) {
            if (action.metadata?.pointsGained) {
                const color = this.gameSession.colors.getUiColor(
                    to.getPlayerState(action.playerId).color
                )
                ids.push(
                    this.add(
                        squareKey(action.space.col, action.space.row),
                        action.metadata.pointsGained,
                        color
                    )
                )
            }
            for (const invasion of action.metadata?.invasions ?? []) {
                const victimColor = this.gameSession.colors.getUiColor(invasion.victimColor)
                ids.push(this.add(invasion.directAnchorSquareKey, -invasion.directPointsLost, victimColor))
                if (invasion.disconnectedAnchorSquareKey) {
                    ids.push(
                        this.add(
                            invasion.disconnectedAnchorSquareKey,
                            -invasion.disconnectedPointsLost,
                            victimColor
                        )
                    )
                }
            }
            this.addForCompletedRegions(action.metadata?.completedRegions, ids)
        }

        return ids
    }

    override async onGameStateChange({ to, action, animationContext }: StateChange) {
        // No fallback: the amounts and their anchor squares live in the action's metadata. Without
        // an action there is nothing to announce - and flashing "-8" over a player who has just
        // lost nothing is exactly what plain history navigation should not do.
        if (!action) return

        const ids = this.collect(action, to).filter((id): id is string => !!id)
        if (ids.length === 0) return

        await tick()

        for (const id of ids) {
            const node = this.nodes.get(id)
            if (!node) continue
            // Set before the browser can paint - the node has just mounted, and this all runs
            // inside the same microtask drain - so the pill starts small and invisible rather than
            // flashing at full size. xPercent/yPercent centre it on its anchor and compose with the
            // y tween below, so gsap owns the whole transform.
            gsap.set(node, { xPercent: -50, yPercent: -50, scale: INITIAL_SCALE, opacity: 0 })
        }

        animationContext.afterAnimations(() => {
            for (const id of ids) {
                const node = this.nodes.get(id)
                if (!node) {
                    this.popups = this.popups.filter((popup) => popup.id !== id)
                    continue
                }

                const timeline = gsap.timeline()
                timeline.to(
                    node,
                    { scale: OVERSHOOT_SCALE, opacity: 1, duration: POP, ease: 'back.out(2.2)' },
                    0
                )
                timeline.to(node, { scale: 1, duration: SETTLE, ease: 'power2.out' }, POP)
                timeline.to(
                    node,
                    {
                        y: -scaled(32),
                        opacity: 0,
                        duration: RISE,
                        ease: 'power1.out',
                        onComplete: () => {
                            this.popups = this.popups.filter((popup) => popup.id !== id)
                        }
                    },
                    POP + SETTLE + SIT
                )
            }
        })
    }
}
