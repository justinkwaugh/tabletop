import type { HydratedNapoleonsTriumphGameState } from '@tabletop/napoleons-triumph'

// A player always sees the faces of their own units, so a state that hides any of them was made for someone else.
export function showsArmyOf(state: HydratedNapoleonsTriumphGameState, playerId: string): boolean {
    return state.unitsOf(playerId).every((unit) => (unit.shown ?? unit.face) !== undefined)
}
