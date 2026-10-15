import { createGameSessionContext } from '@tabletop/frontend-components'
import { ReefEncounterGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<ReefEncounterGameSession>()

export function setGameSession(session: ReefEncounterGameSession) {
    setContext(session)
}

export function getGameSession(): ReefEncounterGameSession {
    return getContext()
}
