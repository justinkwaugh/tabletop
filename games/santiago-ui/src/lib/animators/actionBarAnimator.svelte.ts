import { gsap } from 'gsap'
import { flushSync, tick } from 'svelte'
import { isPlaceBid } from '@tabletop/santiago'
import { closingBidsView, sameActionBarView, type ActionBarView } from '$lib/model/actionBarView.js'
import { FALLBACK_DURATION, StateAnimator, type StateChange } from './stateAnimator.js'

const RESIZE = 0.3
const FADE = 0.2
const OVERSEER_WIPE = 0.4
const CLOSING_BIDS_HOLD = 1.2

// Previews where the whole transition ends, not each step's `to`, so a chain of system actions
// settles the bar once; the preview holds until that state publishes for the same reason. See the
// visual contract's "Action bar transitions".
export class ActionBarAnimator extends StateAnimator {
    preview: ActionBarView | undefined = $state.raw(undefined)
    previewInert = $state(false)

    private bar: HTMLElement | undefined
    // Going inert drops focus from a control in the bar; that control gets it back once the bar
    // is live again.
    private focusBeforePreview: HTMLElement | undefined
    private readonly overseerTags = new Map<string, HTMLElement>()
    // Counts cleared transitions, so a swap still queued on the timelines of a transition that
    // failed, and was cleared without publishing, does nothing.
    private clearedTransitions = 0

    setBar(element?: HTMLElement) {
        this.bar = element
    }

    overseerTag(playerId: string) {
        return (element: HTMLElement) => {
            this.overseerTags.set(playerId, element)
            return () => {
                this.overseerTags.delete(playerId)
            }
        }
    }

    clearPreview() {
        this.clearedTransitions++
        this.preview = undefined
        this.previewInert = false
        const tags = [...this.overseerTags.values()]
        gsap.killTweensOf(tags)
        gsap.set(tags, { clearProps: 'clipPath' })
        if (this.bar) {
            gsap.killTweensOf(this.bar)
            gsap.set(this.bar, { clearProps: 'height,overflow,opacity' })
        }
        const control = this.focusBeforePreview
        this.focusBeforePreview = undefined
        if (!control) return
        void tick().then(() => {
            const focusWasDropped = document.activeElement === null || document.activeElement === document.body
            if (control.isConnected && focusWasDropped) control.focus({ preventScroll: true })
        })
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        // Lets the session's own resets for this transition, such as a cleared bribe selection,
        // render before the bar is measured, and measures outside the session's state effect.
        await tick()
        const bar = this.bar
        if (!from || !bar) return

        const shown = this.gameSession.actionBarView
        const next = this.gameSession.actionBarViewIn(this.gameSession.incomingGameState)
        if (sameActionBarView(shown, next)) return
        const transition = this.clearedTransitions

        // The round's last bid first settles in the bidding table, which holds a moment before
        // the bar moves on.
        const closing =
            action && isPlaceBid(action) && action.playerId && next.kind !== 'bidding'
                ? closingBidsView(shown, { playerId: action.playerId, amount: action.amount }, to.canalOverseerId)
                : undefined
        const stages = closing ? [closing, next] : [next]
        const timeline = action ? animationContext.finalTimeline : animationContext.actionTimeline
        const resize = action ? RESIZE : FALLBACK_DURATION

        let before = shown
        let heightBefore = bar.offsetHeight
        let at = 0
        const heights = stages.map((view) => this.measure(bar, view))
        stages.forEach((view, index) => {
            const heightAfter = heights[index]
            const resizes = heightAfter !== heightBefore
            const overseerTag = action ? this.newOverseerTag(before, view) : undefined
            const holds = view === closing
            if (resizes || overseerTag || holds) {
                const lockedHeight = resizes ? heightBefore : undefined
                const fadesIn = !!action && view.kind !== before.kind
                timeline.call(
                    () => {
                        if (transition === this.clearedTransitions) this.swapTo(bar, view, lockedHeight, fadesIn)
                    },
                    [],
                    at
                )
                if (overseerTag) {
                    timeline.fromTo(
                        overseerTag,
                        { clipPath: 'inset(0% 100% 0% 0%)' },
                        { clipPath: 'inset(0% 0% 0% 0%)', duration: OVERSEER_WIPE, ease: 'power2.out', immediateRender: false },
                        at
                    )
                    timeline.set(overseerTag, { clearProps: 'clipPath' }, at + OVERSEER_WIPE)
                }
                if (resizes) {
                    timeline.fromTo(
                        bar,
                        { height: heightBefore },
                        { height: heightAfter, duration: resize, ease: 'power2.inOut', immediateRender: false },
                        at
                    )
                    timeline.set(bar, { clearProps: 'height,overflow' }, at + resize)
                    if (fadesIn) timeline.to(bar, { opacity: 1, duration: FADE, ease: 'power1.out' }, at + resize)
                }
            }
            at += holds ? CLOSING_BIDS_HOLD : 0
            before = view
            heightBefore = heightAfter
        })
    }

    private swapTo(bar: HTMLElement, next: ActionBarView, lockedHeight: number | undefined, fadesIn: boolean) {
        if (lockedHeight !== undefined) {
            gsap.set(bar, { height: lockedHeight, overflow: 'hidden', opacity: fadesIn ? 0 : 1 })
        }
        const focused = document.activeElement
        if (focused instanceof HTMLElement && bar.contains(focused)) this.focusBeforePreview = focused
        flushSync(() => {
            this.preview = next
            this.previewInert = true
        })
    }

    private newOverseerTag(shown: ActionBarView, next: ActionBarView): HTMLElement | undefined {
        if (next.kind !== 'bidding' || !next.overseerId) return undefined
        if (shown.kind === 'bidding' && shown.overseerId === next.overseerId) return undefined
        return this.overseerTags.get(next.overseerId)
    }

    // Lays the bar out with `view` and back again within one task, so the browser never paints it.
    private measure(bar: HTMLElement, view: ActionBarView): number {
        const shown = this.preview
        flushSync(() => {
            this.preview = view
        })
        const height = bar.offsetHeight
        flushSync(() => {
            this.preview = shown
        })
        return height
    }
}
