import { Charters, type Charter, type KingdomCharter } from '../data/writs.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import type { CharterRegistration } from './writRegistry.js'

/** R-4.4.3, R-6.2-H1 */
function kingdomScore(
    { spaces, vpByLocationsRuled }: KingdomCharter,
    state: HydratedFeudumGameState,
    playerId: string
): number {
    const ruled = state.ruledSpaceIds(playerId).filter((spaceId) => spaces.includes(spaceId)).length
    return ruled === 0 ? 0 : vpByLocationsRuled[Math.min(ruled, vpByLocationsRuled.length) - 1]
}

/** R-4.4.3, R-6.2, R-6.2-H1, R-6.2-H2 What the charter pays, read from its own row. */
function scoreOf(charter: Charter): CharterRegistration['score'] {
    switch (charter.kind) {
        case 'kingdom':
            return (state, playerId) => kingdomScore(charter, state, playerId)
        case 'sulfur-barrel':
            return (state, playerId) => {
                const { barrel } = state.getPlayerState(playerId)
                return charter.vpBySulfur.find(({ sulfur }) => sulfur === barrel)?.vp ?? 0
            }
        case 'monster-defeat':
            return (state, playerId) =>
                state.getPlayerState(playerId).defeatedMonster ? charter.vp : 0
    }
}

/** R-4.4.3, R-6.2 The eight charters, each row holding its printed text beside its values. */
export const CharterRegistrations: readonly CharterRegistration[] = Charters.map((charter) => ({
    writId: charter.id,
    timing: 'end-scoring',
    printedText: charter.text,
    score: scoreOf(charter)
}))
