import { getContext, setContext } from 'svelte'

const FULL_SCREEN = Symbol('ride-the-rails.full-screen')

/**
 * Marks the components below as inside full screen's dialog (docs/game-ui-layout.md, Full
 * screen), where nothing outside it, the railroad cards among it, can be reached.
 */
export function setInFullScreen() {
    setContext(FULL_SCREEN, true)
}

/** Whether this component is inside full screen's dialog. Call it while the component initialises. */
export function isInFullScreen(): boolean {
    return getContext<boolean | undefined>(FULL_SCREEN) === true
}
