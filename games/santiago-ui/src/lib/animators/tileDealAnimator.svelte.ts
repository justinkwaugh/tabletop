import { gsap } from 'gsap'
import { tick } from 'svelte'
import { isRevealTiles, type PlantingTile } from '@tabletop/santiago'
import { FALLBACK_DURATION, StateAnimator, type StateChange } from './stateAnimator.js'

const GROW = 0.3
const FADE = 0.2
const MOVE = 0.22
const PAUSE = 0.025
const FLIP = 0.3

// A reveal in two beats. First the action bar grows to the height its bidding content needs,
// pushing the board and the tile strip down, and that content fades in. Then the draw pile, which
// starts alone at the top of the column, deposits a tile where it stands and slides down one slot at
// a time, leaving a tile at each; every tile appears under the resting pile and flips from the
// pile's back design to its face as the pile moves on. The pile ends at its home below the tiles.
// The bidding content and the tiles come from the action's `to` state and are rendered through
// `previewBidding` and `dealingTiles` for exactly one action (Pattern C), because the reactive
// state still shows the reveal phase until the timelines finish.
export class TileDealAnimator extends StateAnimator {
    dealingTiles: PlantingTile[] | undefined = $state(undefined)
    previewBidding = $state(false)

    private drawPile: HTMLElement | undefined
    private actionBar: HTMLElement | undefined
    private readonly tileNodes = new Map<number, HTMLElement>()

    setDrawPile(element?: HTMLElement) {
        this.drawPile = element
    }

    setActionBar(element?: HTMLElement) {
        this.actionBar = element
    }

    setTileNode(index: number, element?: HTMLElement) {
        if (element) this.tileNodes.set(index, element)
        else this.tileNodes.delete(index)
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        if (!from || from.revealedTiles.length > 0 || to.revealedTiles.length === 0) return

        const cinematic = !!action && isRevealTiles(action)
        const barHeightBefore = this.actionBar?.offsetHeight ?? 0
        this.previewBidding = cinematic
        this.dealingTiles = to.revealedTiles
        await tick()
        const nodes: HTMLElement[] = []
        for (const index of to.revealedTiles.keys()) {
            const node = this.tileNodes.get(index)
            if (!node) {
                this.dealingTiles = undefined
                return
            }
            nodes.push(node)
        }
        animationContext.afterAnimations(() => {
            this.dealingTiles = undefined
            this.previewBidding = false
        })

        const pile = this.drawPile
        const timeline = animationContext.actionTimeline
        if (!pile || !cinematic) {
            gsap.set(nodes, { opacity: 0, rotationY: 180 })
            timeline.to(nodes, { opacity: 1, duration: FALLBACK_DURATION, ease: 'power1.out' }, 0)
            return
        }

        let arrival = this.growActionBar(timeline, barHeightBefore)

        // Each slot stays empty until the pile is resting on it; the tile only becomes visible
        // underneath the pile, so nothing shows in a slot before the pile has been there. The
        // previewed tiles have already pushed the pile to its home at the bottom of the column, so
        // it is held at the first slot until the deal starts. Pile and slots share one offset
        // parent and never reflow mid-deal, so layout offsets give the travel in the column's own
        // coordinates, unaffected by ScalingWrapper.
        gsap.set(nodes, { opacity: 0, rotationY: 0, transformOrigin: 'center center' })
        const slotY = (index: number) => nodes[index].offsetTop - pile.offsetTop
        gsap.set(pile, { y: slotY(0) })
        nodes.forEach((node, index) => {
            timeline.set(node, { opacity: 1 }, arrival)
            timeline.to(node, { rotationY: 180, duration: FLIP, ease: 'power2.out' }, arrival)
            arrival += PAUSE
            const nextY = index + 1 < nodes.length ? slotY(index + 1) : 0
            timeline.to(pile, { y: nextY, duration: MOVE, ease: 'power1.inOut' }, arrival)
            arrival += MOVE
        })
    }

    // Tweens the bar's height from what it was to what its previewed bidding content needs, which
    // slides everything below it down, then fades that content in. Returns when the deal may start.
    private growActionBar(timeline: gsap.core.Timeline, heightBefore: number): number {
        const bar = this.actionBar
        if (!bar) return 0
        const content = bar.firstElementChild
        const heightAfter = bar.offsetHeight
        if (content) gsap.set(content, { opacity: 0 })
        if (heightAfter !== heightBefore) {
            gsap.set(bar, { height: heightBefore, overflow: 'hidden' })
            timeline.to(bar, { height: heightAfter, duration: GROW, ease: 'power2.inOut' }, 0)
            timeline.set(bar, { clearProps: 'height,overflow' }, GROW)
        }
        if (content) {
            timeline.to(content, { opacity: 1, duration: FADE, ease: 'power1.out' }, GROW)
        }
        return GROW + FADE
    }
}
