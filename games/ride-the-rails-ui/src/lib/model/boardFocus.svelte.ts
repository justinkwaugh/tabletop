import type { BoardFocus } from '$lib/utils/boardFocus.js'

/** The focus chooser's selection: set by a choice, released once the view is moved by hand. */
export class BoardFocusSelection {
    current = $state<BoardFocus | undefined>(undefined)

    choose(focus: BoardFocus) {
        this.current = focus
    }

    release() {
        this.current = undefined
    }
}
