import { gsap } from 'gsap'
import { tick } from 'svelte'
import type { Color } from '@tabletop/common'
import { isPlayRenegadeCard } from '@tabletop/lowenherz'
import { CELL_SIZE, scaled } from '$lib/model/boardMetrics.js'
import { StateAnimator, type StateChange } from './stateAnimator.js'

/**
 * The renegade knight changing sides: it lifts off its old square, arcs across, and settles on the
 * new one having taken the new owner's colour on the way. Renegade is "remove theirs, place yours"
 * in the rules, but as one gesture it reads as a single knight defecting - which is what the card is
 * called.
 *
 * This was 900ms of CSS @keyframes fired from a state-change listener with a setTimeout to clean up.
 * It looked the same, but it did not participate in the framework: the board updated underneath the
 * flight instead of waiting for it, `full-action` history replay never showed it, and the keyframes
 * could not be placed on a timeline alongside anything else.
 *
 * The sequencing has one consequence worth knowing. Because the session assigns state only after the
 * timeline finishes, the victim's knight is STILL on its old square for the whole flight - so
 * `departureSquare` below is published for the board to suppress it (Pattern C, a pre-reactivity
 * override). The landing square needs no such treatment: in `from` it is empty, and by the time it
 * holds a knight the flight is over.
 */
type Flight = {
    id: string
    left: number
    top: number
    dx: number
    dy: number
    fromCol: number
    fromRow: number
    fromColor: Color
    toColor: Color
}

const TRAVEL = 0.45 // seconds per half of the arc; 0.9 total, as the keyframes were
const COLOUR_TURN_AT = 0.2 // held to the middle: clearly the old colour lifting, the new one landing
const COLOUR_TURN = 0.45
const APEX_SCALE = 1.4

export class RenegadeFlightAnimator extends StateAnimator {
    /** Presence only - the tween drives the motion, never per-frame reactive writes. */
    flight: Flight | undefined = $state(undefined)

    private wrapper: HTMLElement | undefined
    private oldColour: HTMLElement | undefined
    private newColour: HTMLElement | undefined

    setWrapper(element?: HTMLElement) {
        this.wrapper = element
    }
    setOldColour(element?: HTMLElement) {
        this.oldColour = element
    }
    setNewColour(element?: HTMLElement) {
        this.newColour = element
    }

    /** The square whose knight the board should hold back while the flight is in the air. */
    get departureSquare(): { col: number; row: number } | undefined {
        return this.flight ? { col: this.flight.fromCol, row: this.flight.fromRow } : undefined
    }

    override async onGameStateChange({ to, action, animationContext }: StateChange): Promise<void> {
        // No fallback path: which knight defected, and from where, is only knowable from the
        // action's metadata. Without it the pieces simply change places, which is what plain
        // history navigation and undo already looked like.
        if (!action || !isPlayRenegadeCard(action)) return

        const metadata = action.metadata as
            | { victimColor: Color; removedSquareKey: string; placedSquareKey: string }
            | undefined
        if (!metadata) return

        const [fromCol, fromRow] = metadata.removedSquareKey.split(',').map(Number)
        const [toCol, toRow] = metadata.placedSquareKey.split(',').map(Number)

        this.flight = {
            id: action.id,
            left: fromCol * CELL_SIZE,
            top: fromRow * CELL_SIZE,
            dx: (toCol - fromCol) * CELL_SIZE,
            dy: (toRow - fromRow) * CELL_SIZE,
            fromCol,
            fromRow,
            fromColor: metadata.victimColor,
            toColor: to.getPlayerState(action.playerId).color
        }

        await tick()
        if (!this.wrapper || !this.oldColour || !this.newColour) {
            this.flight = undefined
            return
        }

        const { dx, dy } = this.flight
        // The lift is what makes the path bow upward instead of sliding flat across the board, and
        // scaling up at the apex says the same thing a second way - a piece nearer the eye is
        // bigger. Both scale with the cell, as the -34px in the old keyframes did not.
        const lift = scaled(34)

        gsap.set(this.wrapper, { x: 0, y: 0, scale: 1, transformOrigin: 'center center' })
        gsap.set(this.oldColour, { opacity: 1 })
        gsap.set(this.newColour, { opacity: 0 })

        const timeline = animationContext.actionTimeline
        timeline.to(
            this.wrapper,
            { x: dx / 2, y: dy / 2 - lift, scale: APEX_SCALE, duration: TRAVEL, ease: 'power2.out' },
            0
        )
        timeline.to(
            this.wrapper,
            { x: dx, y: dy, scale: 1, duration: TRAVEL, ease: 'power2.in' },
            TRAVEL
        )
        timeline.to(
            this.oldColour,
            { opacity: 0, duration: COLOUR_TURN, ease: 'none' },
            COLOUR_TURN_AT
        )
        timeline.to(
            this.newColour,
            { opacity: 1, duration: COLOUR_TURN, ease: 'none' },
            COLOUR_TURN_AT
        )

        // Action-scoped: dropped in the last hook before the session assigns the new state, so the
        // real knight appears on its new square in the same drain the flight node leaves.
        animationContext.afterAnimations(() => {
            this.flight = undefined
        })
    }
}
