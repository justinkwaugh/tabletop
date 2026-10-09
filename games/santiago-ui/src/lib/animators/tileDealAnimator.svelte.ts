import { gsap } from 'gsap'
import { tick } from 'svelte'
import { isRevealTiles } from '@tabletop/santiago'
import { FALLBACK_DURATION, StateAnimator, type StateChange } from './stateAnimator.js'

const MOVE = 0.22
const PAUSE = 0.025
const FLIP = 0.3

// The dealt tiles come from the action's `to` state through the session's board preview, because
// the reactive state still shows the reveal phase until the timelines finish. See the visual
// contract's "Tile deal animation".
export class TileDealAnimator extends StateAnimator {
    private drawPile: HTMLElement | undefined
    private readonly tileNodes = new Map<number, HTMLElement>()

    setDrawPile(element?: HTMLElement) {
        this.drawPile = element
    }

    setTileNode(index: number, element?: HTMLElement) {
        if (element) this.tileNodes.set(index, element)
        else this.tileNodes.delete(index)
    }

    clearPreview() {
        const nodes = [...this.tileNodes.values()]
        gsap.killTweensOf(nodes)
        gsap.set(nodes, { clearProps: 'opacity,transform' })
        if (this.drawPile) {
            gsap.killTweensOf(this.drawPile)
            gsap.set(this.drawPile, { clearProps: 'transform' })
        }
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        if (!from || from.revealedTiles.length > 0 || to.revealedTiles.length === 0) return

        const cinematic = !!action && isRevealTiles(action)
        const preview = this.gameSession.boardPreview
        preview.showTiles(to.revealedTiles, true)
        await tick()
        const nodes: HTMLElement[] = []
        for (const index of to.revealedTiles.keys()) {
            const node = this.tileNodes.get(index)
            if (!node) {
                preview.showTiles(to.revealedTiles, false)
                return
            }
            nodes.push(node)
        }

        const pile = this.drawPile
        const timeline = animationContext.actionTimeline
        if (!pile || !cinematic) {
            gsap.set(nodes, { opacity: 0, rotationY: 180 })
            timeline.to(nodes, { opacity: 1, duration: FALLBACK_DURATION, ease: 'power1.out' }, 0)
            return
        }

        let arrival = 0

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
}
