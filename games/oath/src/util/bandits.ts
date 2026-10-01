import { HydratedOathGameState } from '../model/gameState.js'

export const BANDIT_CHIEF = 'denizen.discord.bandit-chief'

/** R-2.8.3 */
export function banditsPerSite(state: HydratedOathGameState): number {
    return banditChiefFaceup(state) ? 3 : 1
}

export function banditChiefFaceup(state: HydratedOathGameState): boolean {
    if (Object.values(state.denizensBySite).some((cards) => cards.includes(BANDIT_CHIEF)))
        return true
    return state.players.some((p) => p.isFaceupAdviser(BANDIT_CHIEF))
}
