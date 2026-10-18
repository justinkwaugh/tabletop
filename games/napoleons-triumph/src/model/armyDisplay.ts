import type { Face } from '../components/pieces.js'
import type { NapoleonsTriumphProjectedState } from './gameState.js'

export function facesOfArmy(
    units: NapoleonsTriumphProjectedState['units'],
    playerId: string
): Face[] | undefined {
    const army = units.filter((unit) => unit.playerId === playerId)
    const faces = army.flatMap((unit) => (unit.face ? [{ ...unit.face }] : []))
    return faces.length === army.length ? faces : undefined
}

/** Compatibility: games begun before the army display was recorded take it from the units wherever every face is known. */
export function withArmyDisplays<State extends NapoleonsTriumphProjectedState>(
    state: State
): State {
    if (!state.players.some((player) => player.side && !player.armyDisplay)) {
        return state
    }
    return {
        ...state,
        players: state.players.map((player) => {
            if (!player.side || player.armyDisplay) {
                return player
            }
            const armyDisplay = facesOfArmy(state.units, player.playerId)
            return armyDisplay ? { ...player, armyDisplay } : player
        })
    }
}
