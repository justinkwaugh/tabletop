<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PanelPalette } from '$lib/utils/playerPanel.js'

    const gameSession = getGameSession()

    let turnPlayerId = $derived(gameSession.gameState.turnManager.currentTurn()?.playerId)
    let plaquePlayerId = $derived(
        gameSession.isViewingHistory || gameSession.gameState.result
            ? undefined
            : gameSession.isMyTurn
              ? gameSession.myPlayer?.id
              : turnPlayerId
    )
</script>

<div
    class="marracash-merchant plaque"
    style:--plaque-fill={plaquePlayerId
        ? gameSession.colors.getPlayerBgColorValue(plaquePlayerId)
        : undefined}
    style:--plaque-ink={plaquePlayerId
        ? gameSession.colors.getPlayerTextColorValue(plaquePlayerId)
        : PanelPalette.gold}
    style:--plaque-edge={plaquePlayerId ? PanelPalette.brass : PanelPalette.trim}
>
    {#if gameSession.isViewingHistory}
        History
    {:else if gameSession.gameState.result}
        End of game
    {:else if gameSession.isMyTurn}
        Your turn
    {:else if turnPlayerId}
        {gameSession.getPlayerName(turnPlayerId)}'s turn
    {/if}
</div>
<div class="medallions">
    {#if gameSession.canUndo}
        <button
            type="button"
            class="marracash-merchant medallion"
            disabled={gameSession.busy}
            onclick={() => gameSession.undo()}>Undo</button
        >
    {/if}
    <button
        type="button"
        aria-label="Player aid"
        aria-expanded={gameSession.playerAidOpen}
        class="marracash-merchant medallion aid"
        class:open={gameSession.playerAidOpen}
        onclick={() => gameSession.togglePlayerAid()}>?</button
    >
</div>

<style>
    .plaque,
    .medallions {
        --tile:
            radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.08) 0 2.5px, #0000 3px) 0 0 /
                12px 12px,
            linear-gradient(160deg, var(--tile-light), var(--tile-deep));
        position: absolute;
        top: calc(var(--header-height) / -2);
        height: var(--header-height);
        z-index: 1;
    }

    .plaque {
        --notch: 14px;
        left: 16px;
        max-width: calc(100% - 140px);
        display: flex;
        align-items: center;
        padding: 0 26px;
        overflow: hidden;
        font-size: 18px;
        letter-spacing: 0.04em;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: var(--plaque-ink);
        isolation: isolate;
        filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.35));
    }

    .plaque::before,
    .plaque::after {
        content: '';
        position: absolute;
        z-index: -1;
        clip-path: polygon(
            var(--notch) 0,
            calc(100% - var(--notch)) 0,
            100% 50%,
            calc(100% - var(--notch)) 100%,
            var(--notch) 100%,
            0 50%
        );
    }

    .plaque::before {
        inset: 0;
        background: var(--plaque-edge);
    }

    .plaque::after {
        --notch: 13px;
        inset: 2px 2.5px;
        background: var(--plaque-fill, var(--tile));
    }

    .medallions {
        right: 14px;
        display: flex;
        gap: 6px;
    }

    .medallion {
        height: var(--header-height);
        min-width: var(--header-height);
        padding: 0 14px;
        border-radius: 999px;
        border: 2px solid var(--trim);
        background: var(--tile);
        color: var(--gold);
        font-size: 15px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        box-shadow: 0 2px 3px rgb(0 0 0 / 0.35);
    }

    .medallion:hover {
        filter: brightness(1.15);
    }

    .medallion:disabled {
        opacity: 0.5;
    }

    .medallion.aid {
        width: var(--header-height);
        padding: 0;
        font-size: 18px;
        text-transform: none;
    }

    .medallion.open {
        background: var(--brass);
        color: var(--tile-deep);
    }

    @media (max-width: 639px) {
        .plaque {
            --notch: 12px;
            padding: 0 20px;
            font-size: 15px;
        }
    }
</style>
