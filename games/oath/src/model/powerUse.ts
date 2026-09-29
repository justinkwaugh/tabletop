import * as Type from 'typebox'
import { PowerChoice } from '../util/powerChoice.js'

export type PowerUse = Type.Static<typeof PowerUse>
export const PowerUse = Type.Object({
    cardId: Type.String(),
    // A card can print two powers of one timing (relic.grand-scepter), and R-X.1 forbids inferring which.
    powerIndex: Type.Integer({ minimum: 0, maximum: 9 }),
    choices: Type.Optional(Type.Array(PowerChoice, { maxItems: 16 }))
})
