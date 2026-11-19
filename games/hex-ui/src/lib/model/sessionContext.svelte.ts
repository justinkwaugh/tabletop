import { createGameSessionContext } from '@tabletop/frontend-components'
import { HexGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<HexGameSession>()

export function setGameSession(session: HexGameSession) {
    setContext(session)
}

export function getGameSession(): HexGameSession {
    return getContext()
}
