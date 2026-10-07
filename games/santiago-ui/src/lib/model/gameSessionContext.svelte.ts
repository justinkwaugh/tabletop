import { createGameSessionContext } from '@tabletop/frontend-components'
import { SantiagoGameSession } from '../stores/SantiagoGameSession.svelte.js'

const [getContext, setContext] = createGameSessionContext<SantiagoGameSession>()

export function setGameSession(session: SantiagoGameSession) {
    setContext(session)
    // The UI Artifact is built without SvelteKit, so $app/environment would ship as an unresolvable import.
    if (import.meta.env?.DEV) window.santiagoSession = session
}

export function getGameSession(): SantiagoGameSession {
    return getContext()
}
