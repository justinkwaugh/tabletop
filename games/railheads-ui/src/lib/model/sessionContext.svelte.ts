import { createGameSessionContext } from '@tabletop/frontend-components'
import { RailheadsGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<RailheadsGameSession>()

export function setGameSession(session: RailheadsGameSession) {
    setContext(session)
}

export function getGameSession(): RailheadsGameSession {
    return getContext()
}
