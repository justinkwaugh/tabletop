<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { BuildingStyle, BuildingType } from '@tabletop/urbino'
    import PieceIcon from './PieceIcon.svelte'

    const session = getGameSession()
    const state = $derived(session.gameState)
    const standings = $derived(state.players.toSorted((a, b) => b.score - a.score))

    const verdict = $derived.by(() => {
        if (state.concededByPlayerId) {
            return `${nameOf(state.concededByPlayerId)} conceded`
        }
        if (state.winningPlayerIds.length > 1) return 'A tie'
        const [winner] = state.winningPlayerIds
        return winner === session.myPlayer?.id ? 'You win' : `${nameOf(winner)} wins`
    })

    function nameOf(playerId: string): string {
        return playerId === session.myPlayer?.id ? 'You' : session.getPlayerName(playerId)
    }
</script>

<div class="urbino-plank flex flex-wrap items-center gap-x-6 gap-y-2 border-b-2 border-(--maple-edge) px-4 py-3 shadow-[0_4px_10px_rgb(0_0_0/0.25)]">
    <div class="urbino-display text-[22px] tracking-[0.1em]">{verdict}</div>
    <div class="flex flex-wrap gap-4">
        {#each standings as player (player.playerId)}
            {@const winner = state.winningPlayerIds.includes(player.playerId)}
            <div class="flex items-center gap-2">
                <PieceIcon
                    buildingType={BuildingType.Tower}
                    color={session.colors.getPlayerUiColor(player.playerId)}
                    buildingStyle={BuildingStyle.TowerRoofs}
                    size={20}
                />
                <span class="text-[17px]" class:font-semibold={winner}>{nameOf(player.playerId)}</span>
                <span class="urbino-display text-[20px]">{player.score}</span>
                {#if winner}<span class="text-(--gold-deep)">★</span>{/if}
            </div>
        {/each}
    </div>
</div>
