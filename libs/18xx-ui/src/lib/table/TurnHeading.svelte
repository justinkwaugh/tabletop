<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'

    let { session, playerId }: { session: EighteenXXSessionView; playerId: string } = $props()
</script>

<div class="turn" role="status" aria-label="Active player">
    <span
        class="player-color"
        style:background={session.colors.getPlayerBgColorValue(playerId)}
        aria-hidden="true"
    ></span><span
        ><span class="possessive"><strong>{session.getPlayerName(playerId)}</strong>’s</span> turn</span
    >
</div>

<style>
    .turn {
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 6px 0 28px;
        font-size: 26px;
        line-height: 32px;
        color: var(--rail-muted, #7f8e9e);
    }
    .possessive {
        white-space: nowrap;
    }
    .turn strong {
        font-weight: 700;
        color: var(--rail-text, #e3e9ef);
    }
    .player-color {
        width: 20px;
        height: 20px;
        margin-right: 10px;
        flex-shrink: 0;
        border-radius: 50%;
    }
</style>
