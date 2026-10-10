import { createGameSessionContext } from '@tabletop/frontend-components'
import { NapoleonsTriumphGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<NapoleonsTriumphGameSession>()

export function setGameSession(session: NapoleonsTriumphGameSession) {
    setContext(session)
}

export function getGameSession(): NapoleonsTriumphGameSession {
    return getContext()
}
