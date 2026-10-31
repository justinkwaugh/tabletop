import { createGameSessionContext } from '@tabletop/frontend-components'
import { DickeKartoffelnGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<DickeKartoffelnGameSession>()

export function setGameSession(session: DickeKartoffelnGameSession) {
    setContext(session)
}

export function getGameSession(): DickeKartoffelnGameSession {
    return getContext()
}
