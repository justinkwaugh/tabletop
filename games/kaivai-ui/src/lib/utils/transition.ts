import { gsap } from 'gsap'
import { Flip } from 'gsap/dist/Flip'
import { fadeScale } from '@tabletop/frontend-components'

gsap.registerPlugin(Flip)

const flipStates = new Map<string, Flip.FlipState>()
const inTransitions = new Set<string>()

export function flipOut(node: Element, params: { key: string }) {
    const key = params.key

    return () => {
        if (inTransitions.has(key)) {
            saveFlipState(node, key)
            inTransitions.delete(key)
            return {
                duration: 1
            }
        } else {
            return fadeScale(node, { duration: 200, baseScale: 0.1 })
        }
    }
}

export function flipIn(node: Element, params: { duration: number; key: string }) {
    inTransitions.add(params.key)
    const key = params.key
    return () => {
        flipKey(key, { duration: params.duration / 1000, targets: node, zIndex: 99 })

        return {
            duration: params.duration
        }
    }
}

export function saveFlipState(node: Element, key: string) {
    const state = Flip.getState(node)
    flipStates.set(key, state)
}

export function flipState(targets: string): Flip.FlipState {
    return Flip.getState(targets)
}

export function flipInterest(key: string) {
    inTransitions.add(key)
}

export function flipKey(key: string, options: Flip.FromToVars) {
    const state = flipStates.get(key)
    if (state) {
        flipStates.delete(key)
        if (options.targets !== state.targets[0]) {
            flip(state, options)
        }
    }
    inTransitions.delete(key)
}

export function flip(state: Flip.FlipState, options: Flip.FromToVars) {
    Flip.from(state, options)
}
