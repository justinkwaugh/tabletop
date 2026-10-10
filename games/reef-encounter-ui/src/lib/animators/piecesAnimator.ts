import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { HydratedReefEncounterGameState } from '@tabletop/reef-encounter'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { byLayer, pieceChanges, tablePieces, type TablePiece } from '$lib/utils/tablePieces.js'

type PiecesCallbacks = {
    gameId: () => string
    // Presence only: draws the `to` pieces, with the leaving ones still in place, before the
    // state swap.
    show: (pieces: TablePiece[]) => void
    // The pieces the transition ended on, kept until the reactive state catches up.
    settle: (pieces: TablePiece[]) => void
    // Whether the action is the viewer's own, just taken: they know what it did, so it plays
    // briskly and they may act again at once.
    isOwnLiveAction: (action: GameAction) => boolean
}

const ACTION = {
    leave: 0.25,
    arrive: 0.3,
    arriveAfterLeaving: 0.15,
    move: 0.45,
    flipHalf: 0.2,
    hold: 0.45
}
const OWN = {
    leave: 0.15,
    arrive: 0.2,
    arriveAfterLeaving: 0.08,
    move: 0.25,
    flipHalf: 0.15,
    hold: 0
}
// Undo and history steps: every path ends within 200ms.
const FAST = {
    leave: 0.15,
    arrive: 0.15,
    arriveAfterLeaving: 0,
    move: 0.18,
    flipHalf: 0.09,
    hold: 0
}

// Pieces are laid onto the table, lifted off it, or slid across it: a polyp drops onto its
// square and an attacked one sinks away, a shrimp walks along its reef, the open sea's polyps
// shuffle along their larva space as it fills.
export class PiecesAnimator {
    private elements = new Map<string, SVGGElement>()

    constructor(private callbacks: PiecesCallbacks) {}

    attach(key: string): Attachment<SVGGElement> {
        return (node) => {
            this.elements.set(key, node)
            return () => {
                if (this.elements.get(key) === node) {
                    this.elements.delete(key)
                }
            }
        }
    }

    async onGameStateChange({
        from,
        to,
        action,
        animationContext
    }: {
        from?: HydratedReefEncounterGameState
        to: HydratedReefEncounterGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        if (!from) {
            return
        }
        const gameId = this.callbacks.gameId()
        const toPieces = tablePieces(to, gameId)
        const { arriving, leaving, moves, flips } = pieceChanges(
            tablePieces(from, gameId),
            toPieces
        )
        if (arriving.length + leaving.length === 0) {
            return
        }

        this.callbacks.show(byLayer([...toPieces, ...leaving]))
        animationContext.afterAnimations(() => this.callbacks.settle(toPieces))
        await tick()

        const timing = !action ? FAST : this.callbacks.isOwnLiveAction(action) ? OWN : ACTION
        const timeline = animationContext.actionTimeline
        const movedFrom = new Set(moves.map(({ source }) => source.key))
        const flippedFrom = new Set(flips.map(({ from }) => from.key))

        for (const piece of leaving) {
            const node = this.elements.get(piece.key)
            if (!node || flippedFrom.has(piece.key)) continue
            if (movedFrom.has(piece.key)) {
                // Its moving copy slides away from here.
                gsap.set(node, { opacity: 0 })
                continue
            }
            gsap.set(node, { transformOrigin: 'center center' })
            timeline.to(
                node,
                { opacity: 0, scale: 0.85, duration: timing.leave, ease: 'power2.in' },
                0
            )
        }

        // A polyp that replaces an attacked one lands once the old one has gone.
        const arriveAt = leaving.length > moves.length ? timing.arriveAfterLeaving : 0
        for (const piece of arriving) {
            const node = this.elements.get(piece.key)
            if (!node) continue
            gsap.set(node, { transformOrigin: 'center center', opacity: 0, scale: 1.25 })
            timeline.to(
                node,
                {
                    opacity: 1,
                    scale: 1,
                    duration: timing.arrive,
                    ease: action ? 'back.out(1.6)' : 'power2.out'
                },
                arriveAt
            )
        }

        for (const { piece, source } of moves) {
            const node = this.elements.get(piece.key)
            if (!node) continue
            gsap.set(node, {
                x: source.center.x - piece.center.x,
                y: source.center.y - piece.center.y
            })
            timeline.to(node, { x: 0, y: 0, duration: timing.move, ease: 'power2.inOut' }, 0)
        }

        // Coral tiles a cylinder flips turn over once it has landed: the old face narrows to its
        // edge and the new one widens from it.
        const flipAt = action ? timing.arrive : 0
        for (const { piece, from } of flips) {
            const oldFace = this.elements.get(from.key)
            const newFace = this.elements.get(piece.key)
            if (!oldFace || !newFace) continue
            gsap.set([oldFace, newFace], { transformOrigin: 'center center' })
            gsap.set(newFace, { scaleX: 0 })
            timeline.to(
                oldFace,
                { scaleX: 0, duration: timing.flipHalf, ease: 'power1.in' },
                flipAt
            )
            timeline.to(
                newFace,
                { scaleX: 1, duration: timing.flipHalf, ease: 'power1.out' },
                flipAt + timing.flipHalf
            )
        }

        if (timing.hold > 0) {
            animationContext.ensureDuration(timing.hold)
        }
    }
}
