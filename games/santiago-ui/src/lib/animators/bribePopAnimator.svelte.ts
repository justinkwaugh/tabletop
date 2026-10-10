import { gsap } from 'gsap'
import { tick } from 'svelte'
import { isSameSegment, type CanalProposal, type CanalSegment } from '@tabletop/santiago'
import { canalProposals } from '$lib/model/turnRules.js'
import { segmentKey } from '$lib/utils/canalGeometry.js'
import { FALLBACK_DURATION, StateAnimator, type StateChange } from './stateAnimator.js'

const POP = 0.45

export function bribePillKey(segment: CanalSegment, playerId: string): string {
    return `${segmentKey(segment)}|${playerId}`
}

// The board draws a proposing step's bribes through `proposals` (Pattern C) so the new pill exists
// to pop before the state publishes; like the other overrides it holds until then, so a later step
// of the same transition cannot drop it.
export class BribePopAnimator extends StateAnimator {
    proposals: CanalProposal[] | undefined = $state.raw(undefined)

    private readonly pills = new Map<string, SVGGElement>()

    pill(key: string) {
        return (element: SVGGElement) => {
            this.pills.set(key, element)
            return () => {
                this.pills.delete(key)
            }
        }
    }

    clearPreview() {
        this.proposals = undefined
        const pills = [...this.pills.values()]
        gsap.killTweensOf(pills)
        gsap.set(pills, { clearProps: 'transform' })
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        if (!from) return
        const before = canalProposals(from)
        const added = canalProposals(to).filter(
            (p) => !before.some((old) => old.playerId === p.playerId && isSameSegment(old.segment, p.segment))
        )
        if (added.length === 0) return

        this.proposals = canalProposals(to)
        await tick()
        const nodes = added.flatMap((p) => this.pills.get(bribePillKey(p.segment, p.playerId)) ?? [])
        if (nodes.length === 0) return
        gsap.set(nodes, { scale: 0, transformOrigin: '50% 50%' })
        animationContext.actionTimeline.to(
            nodes,
            { scale: 1, duration: action ? POP : FALLBACK_DURATION, ease: action ? 'back.out(2.2)' : 'power1.out' },
            0
        )
    }
}
