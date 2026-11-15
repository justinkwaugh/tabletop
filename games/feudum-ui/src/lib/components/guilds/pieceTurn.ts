import { getContext, setContext } from 'svelte'

const PieceTurnKey = Symbol('feudum-piece-turn')

type Turn = () => number

/**
 * R-1.2.3 Inside a guild area stood upright off the board, the turn in degrees that stands a piece or
 * a word of ours upright again about its own centre; on the board, none.
 */
export function setPieceTurn(turn: Turn): void {
    setContext(PieceTurnKey, turn)
}

export function pieceTurn(): Turn {
    return getContext<Turn | undefined>(PieceTurnKey) ?? (() => 0)
}
