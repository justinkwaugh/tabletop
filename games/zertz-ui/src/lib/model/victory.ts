import { assertExists } from '@tabletop/common'
import {
    EndReason,
    MARBLE_COLORS,
    SETUP_RULES,
    type MarbleColor,
    type ZertzGameState
} from '@tabletop/zertz'

export type Victory =
    | { reason: EndReason.Captures; eachColor: number }
    | { reason: EndReason.Captures; color: MarbleColor; count: number }
    | { reason: EndReason.FullBoard }
    | { reason: EndReason.NoMarbles; loserId: string }
    | { reason: EndReason.Repetition }

export function victoryOf(state: ZertzGameState): Victory {
    const [winnerId] = state.winningPlayerIds
    const winner = state.players.find((player) => player.playerId === winnerId)
    assertExists(winner, 'A finished game has a winner')
    assertExists(state.endReason, 'A finished game has an end reason')
    switch (state.endReason) {
        case EndReason.FullBoard:
            return { reason: EndReason.FullBoard }
        case EndReason.Repetition:
            return { reason: EndReason.Repetition }
        case EndReason.NoMarbles: {
            const loser = state.players.find((player) => player.playerId !== winnerId)
            assertExists(loser, 'A two-player game has a loser')
            return { reason: EndReason.NoMarbles, loserId: loser.playerId }
        }
        case EndReason.Captures: {
            const { win } = SETUP_RULES[state.setup]
            const color = MARBLE_COLORS.find(
                (candidate) => winner.captured[candidate] >= win.singleColor[candidate]
            )
            return color === undefined
                ? { reason: EndReason.Captures, eachColor: win.eachColor }
                : { reason: EndReason.Captures, color, count: winner.captured[color] }
        }
    }
}
