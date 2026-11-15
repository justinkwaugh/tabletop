import { PALACE_COLORS } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { HydratedMedinaGameState, type MedinaProjectedState } from '../model/gameState.js'

// For specs: every placement open to the acting player.
export function legalActions(
    state: MedinaProjectedState
): (Record<string, unknown> & { type: ActionType })[] {
    const hydrated = new HydratedMedinaGameState(structuredClone(state))
    const [playerId] = hydrated.activePlayerIds
    const player = hydrated.getPlayerState(playerId)
    const moves: (Record<string, unknown> & { type: ActionType })[] = []
    for (const color of PALACE_COLORS) {
        if (player.buildingStock()[color] > 0) {
            for (const coords of hydrated.buildingSpaces(color)) {
                moves.push({ type: ActionType.PlaceBuilding, color, coords })
            }
        }
    }
    for (const neutral of [false, true]) {
        for (const palace of hydrated.claimablePalaces(playerId, neutral)) {
            moves.push({
                type: ActionType.PlaceRooftop,
                coords: hydrated.palaceBuildings(palace.id)[0],
                neutral
            })
        }
    }
    if (player.stablesLeft() > 0) {
        for (const { coords } of hydrated.stableSpaces()) {
            moves.push({ type: ActionType.PlaceStable, coords })
        }
    }
    if (player.merchantsLeft() > 0) {
        for (const coords of hydrated.merchantSpaces()) {
            moves.push({ type: ActionType.PlaceMerchant, coords })
        }
    }
    if (player.wallsLeft() > 0) {
        for (const section of hydrated.wallSections()) {
            moves.push({ type: ActionType.PlaceWall, ...section })
        }
    }
    return moves
}
