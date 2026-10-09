import * as Type from 'typebox'
import { CoralColor } from '../components/colors.js'

// Actions 2 and 3 each play one larva cube; its colour's polyps follow, up to four from behind the screen.
export const LarvaCubesPerTurn = 2
export const ScreenPolypsPerLarvaCube = 4

export type PlacingPolyps = Type.Static<typeof PlacingPolyps>
export const PlacingPolyps = Type.Object({
    color: Type.Enum(CoralColor),
    screenPolypsLeft: Type.Number()
})

export type TurnRecord = Type.Static<typeof TurnRecord>
export const TurnRecord = Type.Object({
    larvaCubesPlayed: Type.Number(),
    shrimpIntroduced: Type.Boolean(),
    // Eating (action 1) must come before every other action of the turn.
    acted: Type.Boolean(),
    // A larva cube bought with a consumed polyp must be played next (designer's 2007 change).
    cubeToPlay: Type.Optional(Type.Enum(CoralColor)),
    placing: Type.Optional(PlacingPolyps)
})

export function newTurnRecord(): TurnRecord {
    return { larvaCubesPlayed: 0, shrimpIntroduced: false, acted: false }
}
