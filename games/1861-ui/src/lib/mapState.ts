import type { HistoricalMapState } from '@tabletop/18xx-ui'

/** 1861 draws nothing on its map beyond the family's: its private hexes' marks are printed. */
export function mapState1861<State extends HistoricalMapState>(state: State): HistoricalMapState {
    return state
}
