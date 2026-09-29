import { Color } from '@tabletop/common'
import { IMPERIAL_COLOR } from '../model/oathEnums.js'

/** R-1.9 — the Exile colours. */
export const OathExileColors = [Color.White, Color.Yellow, Color.Blue, Color.Red, Color.Black]

/** R-1.8 — every colour a seat can hold: the Exiles' and the Empire's purple. */
export const OathColors = [...OathExileColors, IMPERIAL_COLOR]
