import { gsap } from 'gsap'
import { tick } from 'svelte'
import { isSameSegment, type CanalSegment, type HydratedSantiagoGameState } from '@tabletop/santiago'
import {
    CANAL_HALF_THICKNESS,
    segmentEnds,
    segmentKey,
    waterEntersAtFarEnd
} from '$lib/utils/canalGeometry.js'
import { FALLBACK_DURATION, StateAnimator, type StateChange } from './stateAnimator.js'

const FADE = 0.3
const FLOW_START = 0.15
const FLOW = 0.7
const REVEAL_PAD = CANAL_HALF_THICKNESS + 2

type RevealBox = { x: number; y: number; width: number; height: number }

// The overrides hold until the state publishes, not just until this step's animations end, so a
// chain of system actions after a build cannot drop the new canal between steps; each build step
// overwrites them with its own state. See the visual contract's "Canal construction".
export class CanalBuildAnimator extends StateAnimator {
    canals: CanalSegment[] | undefined = $state.raw(undefined)
    revealingKey: string | undefined = $state(undefined)

    private revealRect: SVGRectElement | undefined
    private readonly surveyNodes = new Map<string, SVGGElement>()
    private faded: SVGGElement[] = []

    setRevealRect(element?: SVGRectElement) {
        this.revealRect = element
    }

    setSurveyNode(key: string, element?: SVGGElement) {
        if (element) this.surveyNodes.set(key, element)
        else this.surveyNodes.delete(key)
    }

    clearPreview() {
        this.canals = undefined
        this.revealingKey = undefined
        gsap.killTweensOf(this.faded)
        if (this.faded.length > 0) gsap.set(this.faded, { clearProps: 'opacity' })
        if (this.revealRect) gsap.killTweensOf(this.revealRect)
        this.faded = []
    }

    override async onGameStateChange({ to, from, action, animationContext }: StateChange) {
        if (!from) return
        const built = to.board.canals.find((seg) => !from.board.canals.some((old) => isSameSegment(old, seg)))
        if (!built) return

        const offeredAfter = new Set(this.gameSession.visibleSegmentsIn(this.gameSession.incomingGameState).map(segmentKey))
        this.canals = to.board.canals
        this.revealingKey = segmentKey(built)
        await tick()

        const timeline = animationContext.actionTimeline
        const fade = action ? FADE : FALLBACK_DURATION
        const withdrawn = [...this.surveyNodes].filter(([key]) => !offeredAfter.has(key)).map(([, node]) => node)
        if (withdrawn.length > 0) timeline.to(withdrawn, { opacity: 0, duration: fade, ease: 'power1.out' }, 0)
        this.faded.push(...withdrawn)

        const rect = this.revealRect
        if (!rect) return
        const { start, end } = this.revealBoxes(built, from)
        gsap.set(rect, { attr: start })
        timeline.to(
            rect,
            { attr: end, duration: action ? FLOW : FALLBACK_DURATION, ease: action ? 'power1.inOut' : 'none' },
            action ? FLOW_START : 0
        )
    }

    private revealBoxes(seg: CanalSegment, from: HydratedSantiagoGameState): { start: RevealBox; end: RevealBox } {
        const { x1, y1, x2, y2 } = segmentEnds(seg)
        const fromFarEnd = waterEntersAtFarEnd(seg, from.board)

        const end: RevealBox = {
            x: x1 - REVEAL_PAD,
            y: y1 - REVEAL_PAD,
            width: x2 - x1 + REVEAL_PAD * 2,
            height: y2 - y1 + REVEAL_PAD * 2
        }
        const horizontal = seg.orientation === 'H'
        const start: RevealBox = horizontal
            ? { ...end, x: fromFarEnd ? x2 + REVEAL_PAD : end.x, width: 0 }
            : { ...end, y: fromFarEnd ? y2 + REVEAL_PAD : end.y, height: 0 }
        return { start, end }
    }
}
