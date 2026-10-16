<script lang="ts">
    import type { HydratedGipfPlayerState } from '@tabletop/gipf'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PieceIcon from './PieceIcon.svelte'

    let { playerState }: { playerState: HydratedGipfPlayerState } = $props()

    const session = getGameSession()

    const isActive = $derived(session.gameState.activePlayerIds.includes(playerState.playerId))
    const isWinner = $derived(session.gameState.winningPlayerIds.includes(playerState.playerId))
    const gipfOnBoard = $derived(session.gameState.board.gipfPiecesOf(playerState.playerId))
    const usesGipf = $derived(session.gameState.rules.usesGipfPieces)
    const opponentColor = $derived(
        session.gameState.getPlayerState(session.gameState.opponentOf(playerState.playerId)).color
    )
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
    <div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 px-3 py-2 text-[15px]">
        <PieceIcon color={playerState.color} size={20} />
        <span><span class="count">{playerState.reserve}</span> in reserve</span>
        {#if usesGipf}
            <PieceIcon color={playerState.color} gipf size={20} />
            <span><span class="count">{gipfOnBoard}</span> GIPF-pieces on the board</span>
        {/if}
        <PieceIcon color={opponentColor} size={20} />
        <span><span class="count">{playerState.captured}</span> captured</span>
    </div>
</div>

<style>
    /* Light enough for black pieces to stand out as well as white ones. */
    .tray {
        border-radius: 12px;
        background: #c9d6e8;
        box-shadow:
            inset 0 0 0 1px #8fa5c4,
            0 3px 8px rgb(0 0 0 / 0.3);
        color: #0d1626;
        overflow: hidden;
    }

    .tray.active {
        box-shadow:
            inset 0 0 0 2px var(--gipf-target),
            0 3px 8px rgb(0 0 0 / 0.35);
    }

    .count {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }
</style>
