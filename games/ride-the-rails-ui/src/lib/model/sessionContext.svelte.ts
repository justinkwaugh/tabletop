import { createGameSessionContext } from '@tabletop/frontend-components'
import { RideTheRailsGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<RideTheRailsGameSession>()

export function setGameSession(session: RideTheRailsGameSession) {
    setContext(session)
}

export function getGameSession(): RideTheRailsGameSession {
    return getContext()
}
