import { LitOffer, type BoardFocus } from '$lib/utils/boardFocus.js'

/** The focus chooser's selection: set by a choice, released once the view is moved by hand. */
export class BoardFocusSelection {
    current = $state<BoardFocus | undefined>(undefined)

    /** The hexes the board last lit, and whether they are still owed a look. */
    readonly offer = new LitOffer()

    choose(focus: BoardFocus) {
        this.current = focus
    }

    release() {
        this.current = undefined
    }

    /** The player moved the view: the choice lets go, and the lit hexes stay where they were put. */
    moveByHand() {
        this.release()
        this.offer.moveByHand()
    }
}
