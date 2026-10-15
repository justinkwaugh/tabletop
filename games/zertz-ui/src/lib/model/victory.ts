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

export function victoryOf(state: ZertzGameState): Victory | undefined {
    const [winnerId] = state.winningPlayerIds
    const winner = state.players.find((player) => player.playerId === winnerId)
    if (winner === undefined || state.endReason === undefined) {
        return undefined
    }
    switch (state.endReason) {
        case EndReason.FullBoard:
            return { reason: EndReason.FullBoard }
        case EndReason.NoMarbles: {
            const loser = state.players.find((player) => player.playerId !== winnerId)
            return loser ? { reason: EndReason.NoMarbles, loserId: loser.playerId } : undefined
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
