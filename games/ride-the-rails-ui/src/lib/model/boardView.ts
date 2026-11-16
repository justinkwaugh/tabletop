import { BuildZoom, LitOffer } from '$lib/utils/boardFocus.js'

/** What moves the board's view for the player, and whether a move by hand has let it go. */
export class BoardView {
    /** Whether the view is where a phone first rests it, kept there as the view resizes. */
    resting = false

    /** The hexes the board last lit, and whether they are still owed a look. */
    readonly offer = new LitOffer()

    /** When the deciding seat's view zooms to its building offer. */
    readonly build = new BuildZoom()

    rest() {
        this.resting = true
    }

    /** The view moved off its rest, by a look at the lit hexes or by hand. */
    leaveRest() {
        this.resting = false
    }

    /** The player moved the view: neither the lit hexes' look nor the building zoom moves it. */
    moveByHand() {
        this.leaveRest()
        this.offer.moveByHand()
        this.build.moveByHand()
    }
}
