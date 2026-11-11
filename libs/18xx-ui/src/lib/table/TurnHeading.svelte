<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'

    let {
        session,
        playerIds,
        waiting = false
    }: {
        session: EighteenXXSessionView
        playerIds: readonly string[]
        waiting?: boolean
    } = $props()
</script>

<div class="turn" role="status" aria-label="Active player">
    {#if waiting}<span class="waiting">Waiting for</span>{/if}
    {#each playerIds as playerId, index (playerId)}
        {#if index}<span class="joiner">and</span>{/if}
        <span
            class="player-color"
            style:background={session.colors.getPlayerBgColorValue(playerId)}
            aria-hidden="true"
        ></span>{#if waiting}<strong>{session.getPlayerName(playerId)}</strong>{:else}<span
                ><span class="possessive"><strong>{session.getPlayerName(playerId)}</strong>’s</span
                > turn</span
            >{/if}
    {/each}
</div>

<style>
    .turn {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        margin: 6px 0 28px;
        font-size: 26px;
        line-height: 32px;
        color: var(--rail-muted, #7f8e9e);
    }
    .possessive,
    .turn strong {
        white-space: nowrap;
    }
    .turn strong {
        font-weight: 700;
        color: var(--rail-text, #e3e9ef);
    }
    .waiting,
    .joiner {
        margin-right: 10px;
    }
    .joiner {
        margin-left: 10px;
    }
    .player-color {
        width: 20px;
        height: 20px;
        margin-right: 10px;
        flex-shrink: 0;
        border-radius: 50%;
    }
</style>
