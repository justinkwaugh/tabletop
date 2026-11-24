import { getContext, setContext } from 'svelte'

const PieceTurnKey = Symbol('feudum-piece-turn')

type Turn = () => number

/** R-1.2.3 Off the board a guild area stands upright, so its pieces turn back. */
export function setPieceTurn(turn: Turn): void {
    setContext(PieceTurnKey, turn)
}

export function pieceTurn(): Turn {
    return getContext<Turn | undefined>(PieceTurnKey) ?? (() => 0)
}
