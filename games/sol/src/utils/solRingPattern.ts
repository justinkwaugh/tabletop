import type { CoordinatePattern, OffsetCoordinates } from '@tabletop/common'
import { FIVE_PLAYER_RING_COUNTS, ONE_TO_FOUR_PLAYER_RING_COUNTS, Ring } from './solGraph.js'

export type RingPatternConfig = {
    numPlayers: number
    ring: Ring
}

export function solRingPattern(config: RingPatternConfig): CoordinatePattern<OffsetCoordinates> {
    return function* pattern() {
        const numNodes =
            config.numPlayers < 5
                ? ONE_TO_FOUR_PLAYER_RING_COUNTS[config.ring]
                : FIVE_PLAYER_RING_COUNTS[config.ring]
        for (let i = 0; i < numNodes; i++) {
            yield { row: config.ring, col: i }
        }
    }
}
