import { createGameSessionContext } from '@tabletop/frontend-components'
import { GipfPotentialsGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<GipfPotentialsGameSession>()

export function setGameSession(session: GipfPotentialsGameSession) {
    setContext(session)
}

export function getGameSession(): GipfPotentialsGameSession {
    return getContext()
}
