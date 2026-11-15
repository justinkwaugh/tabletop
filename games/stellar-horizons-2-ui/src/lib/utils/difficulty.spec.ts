import { describe, expect, it } from 'vitest'
import {
    AnomalyChallenge,
    Faction,
    ScenarioId,
    TitleId,
    anomalyDifficulty,
    anomalyDefinition
} from '@tabletop/stellar-horizons-2'
import { hydrate, startedGame } from '@tabletop/stellar-horizons-2/testing'
import { difficultyAdjustments, difficultySum } from './difficulty.js'

describe('difficulty adjustments', () => {
    it('name the faction, cards and titles behind a player’s difficulty, adding up to it', () => {
        const state = hydrate(startedGame(2, { scenario: ScenarioId.Campaign }).state)
        const player = state.players.find((entry) => entry.faction === Faction.Starfarers)
        if (!player) throw new Error('No Starfarers')
        const playerId = player.playerId
        player.cards.push({ cardId: 'cunning', year: 2100, bought: true })
        player.titles.push(TitleId.Mastermind)
        // Stellar Flares: a science challenge printed at 3.
        const adjustments = difficultyAdjustments(state, playerId, AnomalyChallenge.Science)
        expect(adjustments).toEqual([
            { source: 'Starfarers', amount: -1 },
            { source: 'Cunning', amount: -1 },
            { source: 'Mastermind', amount: -2 }
        ])
        const printed = anomalyDefinition('stellar-flares').difficulty
        expect(
            printed +
                state.numPlayers +
                adjustments.reduce((total, adjustment) => total + adjustment.amount, 0)
        ).toBe(anomalyDifficulty(state, 'stellar-flares', playerId))
        expect(difficultySum(printed, state.numPlayers, adjustments)).toBe(
            '3 + 2 players − 1 Starfarers − 1 Cunning − 2 Mastermind'
        )
        // Combat has only Cunning's.
        expect(difficultyAdjustments(state, playerId, AnomalyChallenge.Combat)).toEqual([
            { source: 'Cunning', amount: -1 }
        ])
    })
})
