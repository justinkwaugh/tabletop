import type { RailroadId } from '@tabletop/promontory-point'
import type { PromontoryPointGameSession } from './session.svelte.js'

// Contract, "Hover preview": a mouse or pen over a hand piece, or keyboard focus on it, previews
// its hexes; touch never does. One per drawn hand, beside the map or in the phone's bar.
export class HandPointer {
    // The piece a mouse or pen is over; touch never holds one.
    private held: RailroadId | undefined

    constructor(private readonly session: Pick<PromontoryPointGameSession, 'hoverPiece'>) {}

    enter(event: PointerEvent, railroadId: RailroadId) {
        if (event.pointerType === 'touch') return
        this.held = railroadId
        this.session.hoverPiece(railroadId)
    }

    leave(event: PointerEvent) {
        if (event.pointerType === 'touch') return
        this.held = undefined
        this.session.hoverPiece(undefined)
    }

    // A tap or click that focuses the piece does not preview, so touch never sets it.
    focus(event: FocusEvent, railroadId: RailroadId) {
        if (
            event.currentTarget instanceof Element &&
            event.currentTarget.matches(':focus-visible')
        ) {
            this.session.hoverPiece(railroadId)
        }
    }

    // Leaving a piece hands the preview back to the piece the pointer holds, if any: a click on
    // another piece blurs this one after the pointer's hover set the preview there.
    blur() {
        this.session.hoverPiece(this.held)
    }
}
