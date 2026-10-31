import { createGameSessionContext } from '@tabletop/frontend-components'
import { PromontoryPointGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<PromontoryPointGameSession>()

export function setGameSession(session: PromontoryPointGameSession) {
    setContext(session)
}

export function getGameSession(): PromontoryPointGameSession {
    return getContext()
}
