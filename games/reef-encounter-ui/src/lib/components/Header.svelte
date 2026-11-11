<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    // Everyone feeds their parrotfish at once, so several players can be active.
    const activePlayerIds = $derived(gameSession.gameState.activePlayerIds)
    const turnPlayerId = $derived(activePlayerIds.length === 1 ? activePlayerIds[0] : undefined)
    const othersTurn = $derived(
        !gameSession.isViewingHistory &&
            !gameSession.gameState.result &&
            !gameSession.isMyTurn &&
            turnPlayerId !== undefined
    )
    const tagPaint = $derived(
        othersTurn ? gameSession.colors.getPlayerBgColorValue(turnPlayerId) : undefined
    )
    const tagInk = $derived(
        othersTurn ? gameSession.colors.getPlayerTextColorValue(turnPlayerId) : undefined
    )
</script>

<div class="header">
    <div class="tag reef-display" style:--tag={tagPaint} style:--tag-ink={tagInk}>
        {#if gameSession.isViewingHistory}
            History
        {:else if gameSession.gameState.result}
            End of game
        {:else if gameSession.isMyTurn}
            Your turn
        {:else if activePlayerIds.length > 1}
            Feeding parrotfish
        {:else if turnPlayerId}
            <PlayerName
                playerId={turnPlayerId}
                possessive={true}
                backgroundOpacity={0}
                additionalClasses="tag-name"
            /> turn
        {/if}
    </div>
    <div class="flex items-center gap-2">
        {#if gameSession.canUndo}
            <button
                type="button"
                class="pebble undo reef-display"
                onclick={() => gameSession.undo()}>Undo</button
            >
        {/if}
        <button
            type="button"
            class="pebble aid reef-display"
            aria-label="Player aid"
            aria-expanded={gameSession.playerAidOpen}
            class:open={gameSession.playerAidOpen}
            onclick={() => gameSession.togglePlayerAid()}>?</button
        >
    </div>
</div>

<style>
    .header {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        height: 44px;
        padding: 0 16px 0 18px;
        margin-bottom: -10px;
    }

    .tag {
        --tag: var(--reef-coral);
        --tag-ink: #fff;
        position: relative;
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 6px 30px 4px 16px;
        font-size: 20px;
        line-height: 1.25;
        color: var(--tag-ink);
        background:
            radial-gradient(ellipse 80% 70% at 30% 20%, rgb(255 255 255 / 0.28), transparent 70%),
            var(--tag);
        border-radius: 14px 0 0 12px / 16px 0 0 12px;
        clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 50%, 100% 100%, 0 100%);
        text-shadow: 0 1px 0 rgb(0 0 0 / 0.18);
    }

    .tag :global(.tag-name) {
        padding: 0;
        color: inherit !important;
    }

    .pebble {
        color: var(--reef-ink);
        background:
            linear-gradient(180deg, rgb(255 255 255 / 0.18), transparent 60%),
            var(--reef-glass-strong);
        backdrop-filter: blur(4px);
        box-shadow:
            inset 0 0 0 1.5px var(--reef-edge),
            0 4px 10px -4px rgb(4 30 26 / 0.5);
        transition: background 0.15s;
    }

    .undo {
        margin-bottom: 2px;
        border-radius: 999px;
        padding: 3px 16px;
        font-size: 16px;
    }

    .aid {
        width: 30px;
        height: 30px;
        margin-bottom: 2px;
        border-radius: 999px;
        font-size: 18px;
        line-height: 1;
    }

    .aid.open {
        background: var(--reef-paper);
        color: var(--reef-paper-ink);
    }

    .undo:hover,
    .aid:not(.open):hover {
        background: var(--reef-teal);
    }

    .undo:focus-visible,
    .aid:focus-visible {
        outline: 2px solid var(--reef-sun);
        outline-offset: 2px;
    }

    @media (max-width: 639px) {
        .header {
            height: 34px;
            padding-inline: 8px;
            margin-bottom: -8px;
        }

        .tag {
            font-size: 16px;
            padding: 4px 22px 2px 10px;
        }

        .undo {
            font-size: 14px;
            padding: 1px 10px;
        }

        .aid {
            width: 24px;
            height: 24px;
            font-size: 15px;
        }
    }
</style>
