import { Color } from '@tabletop/common'

/** R-1.9 — the Exile colours. */
export const OathExileColors = [Color.White, Color.Yellow, Color.Blue, Color.Red, Color.Black]

/** R-1.8 — the Empire's printed colour, which the Chancellor's seat shows. */
export const OathImperialColor = Color.Purple

/** R-1.8 — every colour a seat can show: the Exiles' and the Empire's. */
export const OathColors = [...OathExileColors, OathImperialColor]
