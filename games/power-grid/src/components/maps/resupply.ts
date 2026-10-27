import { Step } from '../rules.js'
import type { ResourceAmounts } from '../resources.js'
import type { ResupplyTable } from './gameMap.js'

function refill(coal: number, oil: number, garbage: number, uranium: number): ResourceAmounts {
    return { coal, oil, garbage, uranium }
}

// The original edition's refill table. Recharged prints only the 5-player card, which matches it
// (rules note R3).
export const ORIGINAL_RESUPPLY: ResupplyTable = {
    2: {
        [Step.One]: refill(3, 2, 1, 1),
        [Step.Two]: refill(4, 2, 2, 1),
        [Step.Three]: refill(3, 4, 3, 1)
    },
    3: {
        [Step.One]: refill(4, 2, 1, 1),
        [Step.Two]: refill(5, 3, 2, 1),
        [Step.Three]: refill(3, 4, 3, 1)
    },
    4: {
        [Step.One]: refill(5, 3, 2, 1),
        [Step.Two]: refill(6, 4, 3, 2),
        [Step.Three]: refill(4, 5, 4, 2)
    },
    5: {
        [Step.One]: refill(5, 4, 3, 2),
        [Step.Two]: refill(7, 5, 3, 3),
        [Step.Three]: refill(5, 6, 5, 2)
    },
    6: {
        [Step.One]: refill(7, 5, 3, 2),
        [Step.Two]: refill(9, 6, 5, 3),
        [Step.Three]: refill(6, 7, 6, 3)
    }
}
