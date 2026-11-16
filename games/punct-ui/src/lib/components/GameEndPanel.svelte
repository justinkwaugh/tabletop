<script lang="ts">
    import { assertExists, GameResult } from '@tabletop/common'
    import { EndReason } from '@tabletop/punct'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const state = $derived(session.gameState)
    const draw = $derived(state.result === GameResult.Draw)

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    function winnerId(): string {
        const [winner] = state.winningPlayerIds
        assertExists(winner, 'A game won has its winner')
        return winner
    }

    function centreCount(playerId: string): number {
        return state.board.centreCount(playerId)
    }

    const headline = $derived.by(() => {
        if (draw) return 'A draw'
        const winner = winnerId()
        return winner === session.myPlayer?.id ? 'You win' : `${nameOf(winner)} wins`
    })

    const reason = $derived.by(() => {
        const endReason = state.endReason
        assertExists(endReason, 'A finished game records why it ended')
        switch (endReason) {
            case EndReason.Connection:
                return `${nameOf(winnerId())} linked two opposite sides`
            case EndReason.CentreCount: {
                if (draw) {
                    const [first] = state.players
                    return `Last piece placed: ${centreCount(first.playerId)} central spaces each`
                }
                const winner = winnerId()
                const loser = state.opponentOf(winner)
                return `Last piece placed: ${centreCount(winner)} central spaces to ${centreCount(loser)}`
            }
            case EndReason.LastPiece:
                return 'Last piece placed with no connection'
            case EndReason.NoMoves:
                return 'Neither player could move'
        }
    })
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--punct-ink)">
    <div class="text-[22px] font-semibold tracking-[0.06em]">{headline}</div>
    <div class="text-[15px] text-(--punct-ink-quiet)">{reason}</div>
</div>
