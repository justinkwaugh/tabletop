<script lang="ts">
    import type { HydratedGipfPlayerState } from '@tabletop/gipf'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { tallyStacks } from '$lib/board/tally.js'
    import { discsOf } from '$lib/board/pieceShape.js'
    import PieceTally from './PieceTally.svelte'

    let { playerState }: { playerState: HydratedGipfPlayerState } = $props()

    const session = getGameSession()

    const isActive = $derived(session.gameState.activePlayerIds.includes(playerState.playerId))
    const isWinner = $derived(session.gameState.winningPlayerIds.includes(playerState.playerId))
    const gipfOnBoard = $derived(session.gameState.board.gipfPiecesOf(playerState.playerId))
    const usesGipf = $derived(session.gameState.rules.usesGipfPieces)
    const opponentColor = $derived(
        session.gameState.getPlayerState(session.gameState.opponentOf(playerState.playerId)).color
    )

    // Each count with its pieces beside it: the reserve and the pieces captured in short stacks,
    // and each GIPF-piece on the board as itself.
    const rows = $derived([
        {
            count: playerState.reserve,
            caption: 'reserve',
            color: playerState.color,
            stacks: tallyStacks(playerState.reserve)
        },
        ...(usesGipf
            ? [
                  {
                      count: gipfOnBoard,
                      caption: 'GIPF',
                      color: playerState.color,
                      stacks: Array<number>(gipfOnBoard).fill(discsOf(true))
                  }
              ]
            : []),
        {
            count: playerState.captured,
            caption: 'captured',
            color: opponentColor,
            stacks: tallyStacks(playerState.captured)
        }
    ])
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
        {#each rows as row (row.caption)}
            <strong class="count">{row.count}</strong>
            <span class="caption">{row.caption}</span>
            <span class="tally">
                <PieceTally color={row.color} stacks={row.stacks} />
            </span>
        {/each}
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

    .rows {
        display: grid;
        grid-template-columns: auto auto 1fr;
        align-items: center;
        column-gap: 8px;
        row-gap: 2px;
        padding: 6px 12px 8px;
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
        color: #3b4a63;
    }

    .tally {
        display: flex;
        justify-content: flex-end;
        min-height: 30px;
        align-items: center;
    }
</style>
