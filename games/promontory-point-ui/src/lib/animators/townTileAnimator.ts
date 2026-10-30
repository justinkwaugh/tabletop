import { prefersReducedMotion } from 'svelte/motion'
import { TownEventKind, isPlaceTrack, type SpaceId } from '@tabletop/promontory-point'
import type { BoardAnimationHost, BoardStateChange, MotionElement } from './markerMotion.js'
import { TOWN_PULSE, pieceSettlesAt } from './placementSchedule.js'

function showScale(element: MotionElement, scale: number) {
    element.setAttribute('transform', `scale(${scale})`)
}

// R-4.2: a Dividend or Repairs tile pulses once under the piece just placed on it, as the piece
// settles. Only a placement shows it: undo, history steps and reduced motion leave the tile still.
export class TownTileAnimator {
    private elements = new Map<SpaceId, MotionElement>()
    private readonly listener = (change: BoardStateChange) => this.onGameStateChange(change)

    constructor(
        private host: BoardAnimationHost,
        private reducedMotion: () => boolean = () => prefersReducedMotion.current
    ) {}

    register() {
        this.host.addGameStateChangeListener(this.listener)
    }

    unregister() {
        this.host.removeGameStateChangeListener(this.listener)
        this.elements.clear()
    }

    setElement(spaceId: SpaceId, element: MotionElement) {
        this.elements.set(spaceId, element)
        showScale(element, 1)
    }

    forget(spaceId: SpaceId, element: MotionElement) {
        if (this.elements.get(spaceId) === element) this.elements.delete(spaceId)
    }

    private async onGameStateChange({ action, animationContext }: BoardStateChange) {
        if (!isPlaceTrack(action) || this.reducedMotion()) return
        const kind = action.metadata?.outcome?.kind
        if (kind !== TownEventKind.Dividend && kind !== TownEventKind.Repairs) return
        const element = this.elements.get(action.spaceId)
        if (!element) return
        const settled = pieceSettlesAt(false)
        const pulse = { scale: 1 }
        const show = () => showScale(element, pulse.scale)
        const timeline = animationContext.actionTimeline
        timeline.to(
            pulse,
            {
                scale: TOWN_PULSE.scale,
                duration: TOWN_PULSE.swellSeconds,
                ease: 'power2.out',
                onUpdate: show
            },
            settled
        )
        timeline.to(
            pulse,
            {
                scale: 1,
                duration: TOWN_PULSE.easeBackSeconds,
                ease: 'power1.inOut',
                onUpdate: show
            },
            settled + TOWN_PULSE.swellSeconds
        )
    }
}

export function pulseTownTile(
    node: SVGGElement,
    params: { animator: TownTileAnimator; spaceId: SpaceId }
) {
    let current = params
    current.animator.setElement(current.spaceId, node)
    return {
        update(next: typeof params) {
            if (next.spaceId !== current.spaceId) {
                current.animator.forget(current.spaceId, node)
                next.animator.setElement(next.spaceId, node)
            }
            current = next
        },
        destroy() {
            current.animator.forget(current.spaceId, node)
        }
    }
}
