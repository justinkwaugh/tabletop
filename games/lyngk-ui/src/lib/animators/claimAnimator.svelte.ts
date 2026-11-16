import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { gsap } from 'gsap'
import type {
    AnimationContext,
    TransitionKind,
    TransitionStep
} from '@tabletop/frontend-components'
import type { HydratedLyngkGameState, PieceColor } from '@tabletop/lyngk'
import type { LyngkGameSession, MoveInterrupter } from '$lib/model/session.svelte.js'
import { pose, stanceOf, type Stance } from './claimFlight.js'

// The claim pieces in the strip: each player's claims, and the neutral colors between them.
export type Claims = { first: PieceColor[]; neutral: PieceColor[]; second: PieceColor[] }
const SIDES = ['first', 'neutral', 'second'] as const

const ANIMATED_KINDS: ReadonlySet<TransitionKind> = new Set<TransitionKind>([
    'own-action',
    'other-action',
    'undo',
    'history',
    'exploration'
])

// A claim played flies over in FLIGHT; a step without an action within QUICK.
const FLIGHT = 0.62
const QUICK = 0.18

type Step = TransitionStep<HydratedLyngkGameState, AnimationContext>

export class ClaimAnimator implements MoveInterrupter {
    // Until the state lands: the claims as the step playing leaves them, so the pieces stand in
    // their new places while they fly there.
    private landing: Claims | undefined = $derived.by(() => {
        void this.session.gameState
        return undefined
    })
    claims: Claims = $derived.by(() => this.landing ?? this.claimsOf(this.session.gameState))

    private readonly tokens = new Map<PieceColor, HTMLElement>()
    private readonly listener = (step: Step) => this.onGameStateChange(step)
    private readonly tweened = new Set<object>()
    private landClaims: (() => void) | undefined

    constructor(private readonly session: LyngkGameSession) {}

    readonly attach: Attachment = () => {
        this.session.addGameStateChangeListener(this.listener)
        this.session.moveInterrupters.add(this)
        return () => {
            this.session.removeGameStateChangeListener(this.listener)
            this.session.moveInterrupters.delete(this)
        }
    }

    // The strip is the same from either side of the board, so turning it leaves a claim flying.
    interrupt() {}

    abandon() {
        const land = this.landClaims
        if (land === undefined) return
        gsap.killTweensOf([...this.tweened])
        land()
    }

    // Each claim piece's wrapper, which flies.
    token(color: PieceColor): Attachment<HTMLElement> {
        return (node) => {
            this.tokens.set(color, node)
            return () => {
                if (this.tokens.get(color) === node) this.tokens.delete(color)
            }
        }
    }

    private async onGameStateChange({ kind, from, to, action, animationContext }: Step) {
        if (from === undefined || !ANIMATED_KINDS.has(kind)) return
        const before = this.claimsOf(from)
        const after = this.claimsOf(to)
        if (this.sameClaims(before, after)) return

        // Where each piece stands now, and once the strip shows the claims as they will be.
        const starts = this.stances()
        this.landing = after
        await tick()
        const ends = this.stances()

        const duration = action === undefined ? QUICK : FLIGHT
        const timeline = animationContext.actionTimeline
        const touched: HTMLElement[] = []
        for (const [color, node] of this.tokens) {
            const start = starts.get(color)
            const end = ends.get(color)
            if (start === undefined || end === undefined) continue
            const dx = start.x - end.x
            const dy = start.y - end.y
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
            touched.push(node)
            node.style.transformOrigin = `50% ${end.ground * 100}%`
            node.style.position = 'relative'
            // The claimed piece flies over the strip; its neighbours slide to make room.
            const flies = this.sideOf(before, color) !== this.sideOf(after, color)
            if (flies) node.style.zIndex = '20'
            const scale = start.width / end.width
            const progress = { u: 0 }
            const write = () => {
                const t = progress.u
                const at = flies
                    ? pose(t, dx, dy, scale)
                    : { x: dx * (1 - t), y: dy * (1 - t), scale: 1 }
                node.style.transform = `translate(${at.x}px, ${at.y}px) scale(${at.scale})`
            }
            write()
            this.tweened.add(progress)
            timeline.to(
                progress,
                { u: 1, duration, ease: flies ? 'none' : 'power2.out', onUpdate: write },
                0
            )
        }

        const land = () => {
            if (this.landClaims === land) this.landClaims = undefined
            this.tweened.clear()
            for (const node of touched) {
                node.style.removeProperty('transform')
                node.style.removeProperty('transform-origin')
                node.style.removeProperty('position')
                node.style.removeProperty('z-index')
            }
        }
        this.landClaims = land
        animationContext.afterAnimations(land)
    }

    private stances(): Map<PieceColor, Stance> {
        const stances = new Map<PieceColor, Stance>()
        for (const [color, node] of this.tokens) stances.set(color, stanceOf(node))
        return stances
    }

    private claimsOf(state: HydratedLyngkGameState): Claims {
        const [first, second] = state.players
        return {
            first: [...first.claimed],
            neutral: state.unclaimedColors(),
            second: [...second.claimed]
        }
    }

    private sideOf(claims: Claims, color: PieceColor): keyof Claims | undefined {
        return SIDES.find((side) => claims[side].includes(color))
    }

    private sameClaims(a: Claims, b: Claims): boolean {
        return SIDES.every(
            (side) =>
                a[side].length === b[side].length &&
                a[side].every((color, index) => b[side][index] === color)
        )
    }
}
