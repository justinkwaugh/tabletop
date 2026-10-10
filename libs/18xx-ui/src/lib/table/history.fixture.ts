import type { EighteenXXState } from '@tabletop/18xx'
import { minimalPlayState } from '@tabletop/18xx/testing'

export function historyStateFixture(): EighteenXXState {
    return {
        ...minimalPlayState(),
        usedPrivatePowerIds: [],
        id: 'state',
        gameId: 'history',
        machineState: 'StockRound',
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        winningPlayerIds: []
    }
}
