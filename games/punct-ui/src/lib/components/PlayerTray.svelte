<script lang="ts">
    import { PIECE_KINDS, Variant, type HydratedPunctPlayerState } from '@tabletop/punct'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PieceIcon from './PieceIcon.svelte'

    let { playerState }: { playerState: HydratedPunctPlayerState } = $props()

    const session = getGameSession()

    const isActive = $derived(session.gameState.activePlayerIds.includes(playerState.playerId))
    const isWinner = $derived(
        session.gameState.result !== undefined &&
            session.gameState.winningPlayerIds.length === 1 &&
            session.gameState.winningPlayerIds.includes(playerState.playerId)
    )
    const standard = $derived(session.gameState.variant === Variant.Standard)
    const centre = $derived(session.gameState.board.centreCount(playerState.playerId))
</script>

<div class="tray" class:active={isActive}>
    <div
        class="flex items-center justify-between rounded-t-[10px] px-3 py-1 font-semibold"
        style:background={session.colors.getPlayerBgColorValue(playerState.playerId)}
        style:color={session.colors.getPlayerTextColorValue(playerState.playerId)}
    >
        <span class="truncate text-[17px]">{session.getPlayerName(playerState.playerId)}</span>
        <span class="text-[13px] tracking-[0.12em] uppercase">
            {#if isWinner}Winner{:else if isActive}Playing{/if}
        </span>
    </div>
    <div class="lines">
        <div class="kinds">
            {#each PIECE_KINDS as kind (kind)}
                {@const count = session.inReserve(playerState.playerId, kind)}
                <span class="kind" class:empty={count === 0}>
                    <PieceIcon color={playerState.color} {kind} scale={0.24} />
                    <span class="kind-count">{count}</span>
                </span>
            {/each}
        </div>
        {#if standard}
            <div class="centre"><strong>{centre}</strong> in centre</div>
        {/if}
    </div>
</div>

<style>
    /* Light enough for black pieces to stand out as well as white ones. */
    .tray {
        border-radius: 12px;
        background: var(--punct-card);
        box-shadow:
            inset 0 0 0 1px var(--punct-card-edge),
            0 3px 8px rgb(0 0 0 / 0.18);
        color: var(--punct-card-ink);
        overflow: hidden;
    }

    .tray.active {
        box-shadow:
            inset 0 0 0 2px var(--punct-target),
            0 3px 8px rgb(0 0 0 / 0.22);
    }

    .lines {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 10px;
    }

    /* One row of six: each kind with its count under it. */
    .kinds {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        align-items: end;
        gap: 4px;
    }

    .centre {
        text-align: center;
        font-size: 14px;
        letter-spacing: 0.04em;
        color: var(--punct-card-quiet);
    }

    .centre strong {
        font-size: 17px;
        color: var(--punct-card-ink);
        font-variant-numeric: tabular-nums;
    }

    .kind {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
    }

    .kind :global(svg) {
        max-width: 100%;
        height: auto;
    }

    .kind.empty {
        opacity: 0.3;
    }

    .kind-count {
        font-size: 14px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }
</style>
