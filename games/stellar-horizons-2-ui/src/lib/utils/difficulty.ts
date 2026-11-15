import {
    AnomalyChallenge,
    cardDefinition,
    factionSheet,
    isCampaign,
    titleDefinition,
    type HydratedStellarHorizonsGameState
} from '@tabletop/stellar-horizons-2'
import { factionName } from './presentation.js'

// One thing that changes a player's difficulty for a challenge: their faction, a card they own
// or a title they hold, by name.
export interface DifficultyAdjustment {
    source: string
    amount: number
}

// What makes a player's difficulty differ from the printed value plus the number of players,
// as the rules apply it (capabilities' `difficulty`).
export function difficultyAdjustments(
    state: HydratedStellarHorizonsGameState,
    playerId: string | undefined,
    challenge: AnomalyChallenge
): DifficultyAdjustment[] {
    if (playerId === undefined) return []
    const player = state.getPlayerState(playerId)
    const science = challenge === AnomalyChallenge.Science
    const faction =
        isCampaign(state) && player.faction
            ? {
                  source: factionName(player.faction).replace(/^The /, ''),
                  amount:
                      (science
                          ? factionSheet(player.faction).abilities.scienceAnomalyDifficulty
                          : factionSheet(player.faction).abilities.combatAnomalyDifficulty) ?? 0
              }
            : undefined
    const cards = player.cards.map((card) => {
        const definition = cardDefinition(card.cardId)
        return {
            source: definition.name,
            amount:
                (science
                    ? definition.effects.scienceDifficulty
                    : definition.effects.combatDifficulty) ?? 0
        }
    })
    const titles = player.titles.map((titleId) => {
        const { name, effects } = titleDefinition(titleId)
        return {
            source: name,
            amount: effects.difficulty?.challenge === challenge ? effects.difficulty.amount : 0
        }
    })
    return [...(faction ? [faction] : []), ...cards, ...titles].filter(
        (adjustment) => adjustment.amount !== 0
    )
}

// "3 + 2 players − 1 Starfarers": how the difficulty shown is reached.
export function difficultySum(
    printed: number,
    players: number,
    adjustments: readonly DifficultyAdjustment[]
): string {
    return [
        `${printed} + ${players} players`,
        ...adjustments.map(
            ({ source, amount }) => `${amount < 0 ? '−' : '+'} ${Math.abs(amount)} ${source}`
        )
    ].join(' ')
}
