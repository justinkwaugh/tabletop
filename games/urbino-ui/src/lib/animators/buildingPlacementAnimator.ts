import { gsap } from 'gsap'

const POP_OVERSHOOT_SCALE = 1.2
const POP_DURATION = 0.4
const SETTLE_DURATION = 0.25

// Set true after the board's first paint so initial buildings don't animate.
let boardReady = false

export function markBoardReady() {
    boardReady = true
}

export function resetBoardReady() {
    boardReady = false
}

export function animateNewBuilding(node: SVGElement) {
    if (!boardReady) return {}

    gsap.fromTo(
        node,
        { scale: INITIAL_SCALE, transformOrigin: 'center center' },
        {
            scale: POP_OVERSHOOT_SCALE,
            duration: POP_DURATION,
            ease: 'back.out(2.2)',
            onComplete: () => { gsap.to(node, { scale: 1, duration: SETTLE_DURATION, ease: 'power2.out' }) },
        }
    )

    return {}
}

const INITIAL_SCALE = 0.2
