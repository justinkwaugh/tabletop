import { BuildZoom, LitOffer, type BoardFocus } from '$lib/utils/boardFocus.js'

/** The focus chooser's selection: set by a choice, released once the view is moved by hand. */
export class BoardFocusSelection {
    current = $state<BoardFocus | undefined>(undefined)

    /** The hexes the board last lit, and whether they are still owed a look. */
    readonly offer = new LitOffer()

    /** When the deciding seat's view zooms to its building offer. */
    readonly build = new BuildZoom()

    choose(focus: BoardFocus) {
        this.current = focus
    }

    release() {
        this.current = undefined
    }

    /** The player moved the view: the choice lets go, and the lit hexes stay where they were put. */
    moveByHand() {
        this.release()
        this.keepPlayersView()
    }

    /** The view is where the player put it: neither the lit hexes' look nor the building zoom moves it. */
    keepPlayersView() {
        this.offer.moveByHand()
        this.build.moveByHand()
    }
}
