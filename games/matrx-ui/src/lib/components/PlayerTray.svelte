<script lang="ts">
    import { PieceKind, type HydratedMatrxPlayerState } from '@tabletop/matrx'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { tallyStacks } from '$lib/board/tally.js'
    import PieceTally from './PieceTally.svelte'
    import ReserveKinds from './ReserveKinds.svelte'

    let { playerState }: { playerState: HydratedMatrxPlayerState } = $props()

    const session = getGameSession()

    const isActive = $derived(session.gameState.activePlayerIds.includes(playerState.playerId))
    const isWinner = $derived(session.gameState.winningPlayerIds.includes(playerState.playerId))
    const gipfLeft = $derived(session.gameState.gipfPiecesLeft(playerState.playerId))
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
    <div class="lines">
        <div class="line reserve">
            <ReserveKinds player={playerState} color={playerState.color} size={30} />
        </div>
        <div class="line">
            <strong class="count">{gipfLeft}</strong>
            <span class="caption">GIPF</span>
            <PieceTally
                color={playerState.color}
                stacks={Array.from({ length: gipfLeft }, () => [PieceKind.Gipf])}
            />
        </div>
        <div class="line">
            <strong class="count">{playerState.captured.length}</strong>
            <span class="caption">captured</span>
            <PieceTally color={opponentColor} stacks={tallyStacks(playerState.captured)} />
        </div>
    </div>
</div>

<style>
    /* Light enough for black pieces to stand out as well as white ones. */
    .tray {
        border-radius: 12px;
        background: var(--matrx-card);
        box-shadow:
            inset 0 0 0 1px var(--matrx-card-edge),
            0 3px 8px rgb(0 0 0 / 0.18);
        color: var(--matrx-card-ink);
        overflow: hidden;
    }

    .tray.active {
        box-shadow:
            inset 0 0 0 2px var(--matrx-target),
            0 3px 8px rgb(0 0 0 / 0.22);
    }

    .lines {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px 12px 8px;
    }

    .line {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 30px;
    }

    .reserve {
        justify-content: center;
    }

    /* Count and caption at the left, the pieces themselves at the right, as in GIPF. */
    .line > :global(svg) {
        margin-left: auto;
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
        color: var(--matrx-card-quiet);
    }
</style>
