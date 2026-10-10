import { shuffle } from '@tabletop/common'
import {
    COMMANDERS,
    STARTING_ARMIES,
    STARTING_MORALE,
    Side,
    opposingSide,
    unitId
} from '../components/pieces.js'
import { SIDE_COLORS } from '../definition/colors.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'

/**
 * Creates both armies off the map. Which block carries which face is drawn from the protected
 * stream, so a unit's id says nothing about what it is.
 */
function raiseArmies(state: HydratedNapoleonsTriumphGameState) {
    const random = state.getProtectedPrng().random
    state.units = []
    for (const side of [Side.French, Side.Allied]) {
        const playerId = state.playerOf(side).playerId
        const faces = STARTING_ARMIES[side].map((face) => ({ ...face }))
        shuffle(faces, random)
        faces.forEach((face, index) => {
            state.units.push({ id: unitId(side, index), playerId, face })
        })
    }
    state.commanders = COMMANDERS.map((definition) => ({
        id: definition.id,
        playerId: state.playerOf(definition.side).playerId
    }))
}

/** Gives one player an army and the other the opposing one, with any morale handicap the chooser accepted. */
export function assignSides(
    state: HydratedNapoleonsTriumphGameState,
    chooserId: string,
    side: Side,
    handicap = 0
) {
    for (const player of state.players) {
        const own = player.playerId === chooserId ? side : opposingSide(side)
        player.side = own
        player.color = SIDE_COLORS[own]
        player.morale = STARTING_MORALE[own] - (player.playerId === chooserId ? handicap : 0)
    }
    state.turnManager.turnOrder = [
        state.playerOf(Side.Allied).playerId,
        state.playerOf(Side.French).playerId
    ]
    raiseArmies(state)
}
