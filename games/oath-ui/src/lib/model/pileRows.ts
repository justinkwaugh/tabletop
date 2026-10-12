import { CardKind, type HydratedOathGameState, type Region } from '@tabletop/oath'
import { regionName } from './names.js'

/** R-9.4 — what a discard pile shows everyone: the back on top, a denizen's when empty, and its count. */
export type Pile = { region: Region; back: CardKind; count: number; name: string }

export function pileBack(state: HydratedOathGameState, region: Region): CardKind {
    return state.discardTopBackIn(region) ?? CardKind.Denizen
}

export function pileOf(state: HydratedOathGameState, region: Region): Pile {
    return {
        region,
        back: pileBack(state, region),
        count: state.discardPileCountIn(region),
        name: `${regionName(region)} pile`
    }
}
