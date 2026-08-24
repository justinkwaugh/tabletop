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
 * Split across the two timelines on purpose, and it is the one animator here that does not put all
 * of its motion on the shared one:
 *
 * - The pop-in goes on `actionTimeline`, so the number is on screen and readable before the board
 *   changes underneath it. That is the part that belongs to the action.
 * - The float-out starts in `afterAnimations` on its own timeline. The session holds the reactive
 *   state update until the shared timeline finishes, so a multi-second drift there would stall the
 *   board after every scoring action. A popup outlives its action - it is an annotation, not the
 *   action's own motion - and gsap's onComplete owns when it goes away.
 */
type Popup = { id: string; col: number; row: number; text: string; color: string }

const POP_IN = 0.18
// Just long enough to register as a beat after the pop, not a wait. The gsap conversion had this at
// 2.2s, which kept the old CSS keyframe's ~4s lifetime but not its character: that version rose
// continuously with an ease-out, so it was already moving as you read it.
const HOLD = 0.2
// Long and eased-out, so most of the travel happens early and the tail is a slow drift.
const FLOAT = 3.4

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
            // xPercent/yPercent centre the popup on its anchor and compose with the y tween below,
            // so gsap owns the whole transform.
            gsap.set(node, { xPercent: -50, yPercent: -50, scale: 0.6, opacity: 0 })
            animationContext.actionTimeline.to(
                node,
                { scale: 1, opacity: 1, duration: POP_IN, ease: 'back.out(2)' },
                0
            )
        }

        animationContext.afterAnimations(() => {
            for (const id of ids) {
                const node = this.nodes.get(id)
                if (!node) {
                    this.popups = this.popups.filter((popup) => popup.id !== id)
                    continue
                }
                gsap.to(node, {
                    y: -scaled(32),
                    opacity: 0,
                    duration: FLOAT,
                    delay: HOLD,
                    ease: 'power1.out',
                    onComplete: () => {
                        this.popups = this.popups.filter((popup) => popup.id !== id)
                    }
                })
            }
        })
    }
}
