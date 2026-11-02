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
    const left = $derived(session.reserveTotal(playerState.playerId))
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
        <div class="line">
            <strong class="count">{left}</strong>
            <span class="caption">left</span>
            <span class="kinds">
                {#each PIECE_KINDS as kind (kind)}
                    {@const count = session.inReserve(playerState.playerId, kind)}
                    <span class="kind" class:empty={count === 0}>
                        <PieceIcon color={playerState.color} {kind} scale={0.15} />
                        <span class="kind-count">{count}</span>
                    </span>
                {/each}
            </span>
        </div>
        {#if standard}
            <div class="line">
                <strong class="count">{centre}</strong>
                <span class="caption">centre</span>
            </div>
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
        gap: 2px;
        padding: 6px 10px 8px;
    }

    .line {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 30px;
    }

    .count {
        min-width: 2ch;
        font-size: 19px;
        text-align: end;
        font-variant-numeric: tabular-nums;
    }

    .caption {
        font-size: 13px;
        letter-spacing: 0.08em;
        color: var(--punct-card-quiet);
    }

    .kinds {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0 4px;
        margin-left: auto;
    }

    .kind {
        display: inline-flex;
        align-items: center;
        gap: 1px;
    }

    .kind.empty {
        opacity: 0.3;
    }

    .kind-count {
        font-size: 12px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }
</style>
