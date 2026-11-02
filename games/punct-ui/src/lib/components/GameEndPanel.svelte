<script lang="ts">
    import { GameResult } from '@tabletop/common'
    import { EndReason } from '@tabletop/punct'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const session = getGameSession()

    const draw = $derived(session.gameState.result === GameResult.Draw)
    const winnerId = $derived(draw ? undefined : session.gameState.winningPlayerIds[0])
    const loserId = $derived(winnerId ? session.gameState.opponentOf(winnerId) : undefined)

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }

    function centreCount(playerId: string): number {
        return session.gameState.board.centreCount(playerId)
    }

    const headline = $derived.by(() => {
        if (draw) return 'A draw'
        if (!winnerId) return ''
        return winnerId === session.myPlayer?.id ? 'You win' : `${nameOf(winnerId)} wins`
    })

    const reason = $derived.by(() => {
        switch (session.gameState.endReason) {
            case EndReason.Connection:
                return winnerId ? `${nameOf(winnerId)} linked two opposite sides` : ''
            case EndReason.CentreCount: {
                if (winnerId && loserId) {
                    return `Last piece placed: ${centreCount(winnerId)} central spaces to ${centreCount(loserId)}`
                }
                const [first] = session.gameState.players
                return `Last piece placed: ${centreCount(first.playerId)} central spaces each`
            }
            case EndReason.LastPiece:
                return 'Last piece placed with no connection'
            case EndReason.NoMoves:
                return 'Neither player could move'
            default:
                return ''
        }
    })
</script>

<div class="flex flex-col items-center gap-1 px-3 py-2 text-center text-(--punct-ink)">
    <div class="text-[22px] font-semibold tracking-[0.06em]">{headline}</div>
    <div class="text-[15px] text-(--punct-ink-quiet)">{reason}</div>
</div>
