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
    <div class="rows">
        <strong class="count">{gipfLeft}</strong>
        <span class="caption">GIPF</span>
        <span class="tally">
            <PieceTally
                color={playerState.color}
                stacks={Array<number>(gipfLeft).fill(1)}
                kind={PieceKind.Gipf}
            />
        </span>
        <span class="reserve">
            <ReserveKinds player={playerState} color={playerState.color} size={22} />
        </span>
        <strong class="count">{playerState.captured}</strong>
        <span class="caption">captured</span>
        <span class="tally">
            <PieceTally color={opponentColor} stacks={tallyStacks(playerState.captured)} />
        </span>
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

    .rows {
        display: grid;
        grid-template-columns: auto max-content 1fr;
        align-items: center;
        column-gap: 8px;
        row-gap: 2px;
        padding: 6px 12px 8px;
    }

    .reserve {
        grid-column: 1 / -1;
        display: flex;
        justify-content: center;
    }

    /* Two digits wide, so both cards' captions line up. */
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

    .tally {
        display: flex;
        justify-content: flex-end;
        min-height: 30px;
        align-items: center;
    }
</style>
