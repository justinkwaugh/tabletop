import * as Type from 'typebox'
import { PowerChoice } from './powerChoice.js'
import { TOTAL_FAVOR } from './oathEnums.js'

export type PowerUse = Type.Static<typeof PowerUse>
export const PowerUse = Type.Object({
    cardId: Type.String(),
    // A card can print two powers of one timing (relic.grand-scepter), and R-X.1 forbids inferring which.
    powerIndex: Type.Integer({ minimum: 0, maximum: 9 }),
    // Memory of Nature names one favor per pick, up to every card the map holds (8 slots of at most 3).
    // Messenger's 16 moves, each its warbands and the site they go to. The longest: Witch's Bargain's
    // steps from revision 32, at most two for each favor in the game (`BARGAIN_MAX_STEPS`).
    choices: Type.Optional(Type.Array(PowerChoice, { maxItems: 2 * TOTAL_FAVOR }))
})
