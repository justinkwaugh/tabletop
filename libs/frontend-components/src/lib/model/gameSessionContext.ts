import type { GameSessionView } from './gameSessionView.js'

import { createContext } from 'svelte'

const [getGameSessionContext, setGameSessionContext] = createContext<GameSessionView>()

export const setGameSession = setGameSessionContext
export const getGameSession = getGameSessionContext

// This can be used to make typesafe game session context setters and getters
export function createGameSessionContext<TSession extends GameSessionView>(): [
    getGameSession: () => TSession,
    setGameSession: (session: TSession) => void
] {
    const [getGameContext, setGameContext] = createContext<TSession>()

    function setGameSession(session: TSession) {
        setGameSessionContext(session)
        setGameContext(session)
    }

    function getGameSession(): TSession {
        return getGameContext()
    }

    return [getGameSession, setGameSession]
}
