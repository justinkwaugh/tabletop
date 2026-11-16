import { createGameSessionContext } from '@tabletop/frontend-components'
import { LyngkGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<LyngkGameSession>()

export function setGameSession(session: LyngkGameSession) {
    setContext(session)
}

export function getGameSession(): LyngkGameSession {
    return getContext()
}
