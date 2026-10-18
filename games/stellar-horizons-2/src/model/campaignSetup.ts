import { factionSheet } from '../components/factionSheets.js'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import { playerFaction, produceAtEarth } from './campaign.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'

// Rulebook 3.0 setup: the faction's initial ships, some still in transit, and starting cash and
// tech markers as if performing Earth production for 2100.
export function setUpCampaignFaction(state: HydratedStellarHorizonsGameState, playerId: string) {
    const sheet = factionSheet(playerFaction(state, playerId))
    for (const initial of sheet.initialShips) {
        const systemId = state.isSystemInPlay(initial.systemId) ? initial.systemId : SOL_SYSTEM_ID
        state.ships[initial.shipId] = {
            shipId: initial.shipId,
            playerId,
            systemId,
            transit: initial.transit,
            damage: 0,
            settlements: 0,
            goods: [],
            loadedFromBase: false,
            explored: false
        }
    }
    produceAtEarth(state, playerId)
}
