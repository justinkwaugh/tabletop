<script lang="ts">
    import type { Snippet } from 'svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { PLAIN_PLAYER_NAME } from '$lib/utils/playerNames.js'
    import Disk from './Disk.svelte'

    let { playerId, children }: { playerId?: string; children: Snippet } = $props()

    const gameSession = getGameSession()
</script>

<p class="line">
    {#if playerId}
        <Disk color={gameSession.colors.getPlayerUiColor(playerId)} size={24} />
        <PlayerName {playerId} {...PLAIN_PLAYER_NAME} />
    {/if}
    {@render children()}
</p>

<style>
    .line {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0 6px;
        font-size: 1.05rem;
        line-height: 1.3;
        color: #e5e7eb;
    }
    .line > :global(svg) {
        margin-right: -4px;
    }
    @media (max-width: 640px) {
        .line {
            font-size: 0.85rem;
            gap: 0 4px;
        }
        .line > :global(svg) {
            width: 18px;
            height: 18px;
        }
    }
</style>
