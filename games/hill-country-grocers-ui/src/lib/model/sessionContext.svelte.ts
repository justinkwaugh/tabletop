import { createGameSessionContext } from '@tabletop/frontend-components'
import { HcgGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<HcgGameSession>()

export function setGameSession(session: HcgGameSession) {
    setContext(session)
}

export function getGameSession(): HcgGameSession {
    return getContext()
}
