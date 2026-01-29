import type { GameSession } from '$lib/model/gameSession.svelte.js'
import { createContext } from 'svelte'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGameSession = GameSession<any, any>

const [getGameSessionContext, setGameSessionContext] =
    createContext<AnyGameSession>()

export const setGameSession = setGameSessionContext
export const getGameSession = getGameSessionContext

// This can be used to make typesafe game session context setters and getters
export function createGameSessionContext<TSession extends AnyGameSession>(): [
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
