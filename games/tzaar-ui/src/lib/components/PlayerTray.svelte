<script lang="ts">
    import {
        MachineState,
        PIECE_KINDS,
        type HydratedTzaarPlayerState,
        type PieceKind
    } from '@tabletop/tzaar'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { KIND_NAMES } from '$lib/history/entryText.js'
    import PieceIcon from './PieceIcon.svelte'

    let { playerState }: { playerState: HydratedTzaarPlayerState } = $props()

    const session = getGameSession()

    const isActive = $derived(session.gameState.activePlayerIds.includes(playerState.playerId))
    const isWinner = $derived(
        session.gameState.result !== undefined &&
            session.gameState.winningPlayerIds.includes(playerState.playerId)
    )
    const tone = $derived(session.toneOfPlayer(playerState.playerId))
    const placing = $derived(session.gameState.machineState === MachineState.PlacingPieces)

    // While placing, the pieces of each type still in hand; after, the stacks each type tops,
    // which the player must keep above none (rule B1).
    function countOf(kind: PieceKind): number {
        return placing
            ? session.gameState.piecesInHand(playerState.playerId, kind)
            : session.gameState.board.topsOf(playerState.playerId, kind)
    }
</script>

<div class="tray" class:active={isActive}>
    <div
        class="flex items-center gap-2 rounded-t-[10px] px-3 py-1 font-semibold"
        style:background={session.colors.getPlayerBgColorValue(playerState.playerId)}
        style:color={session.colors.getPlayerTextColorValue(playerState.playerId)}
    >
        <span class="truncate text-[17px]">{session.getPlayerName(playerState.playerId)}</span>
        <span class="ms-auto text-[13px] tracking-[0.12em] whitespace-nowrap uppercase">
            {#if isWinner}Winner{:else if isActive}Playing{/if}
        </span>
    </div>
    <div class="body">
        {#each PIECE_KINDS as kind (kind)}
            {@const count = countOf(kind)}
            <div class="kind" class:out={count === 0 && !placing} title={KIND_NAMES[kind]}>
                <strong>{count}</strong>
                <PieceIcon {tone} {kind} size={34} />
            </div>
        {/each}
        <span class="caption">{placing ? 'left' : 'on top'}</span>
    </div>
</div>

<style>
    /* Cream like the action card, light enough for black pieces to stand out as well as white ones. */
    .tray {
        border-radius: 12px;
        background: var(--tzaar-panel);
        box-shadow:
            inset 0 0 0 1px var(--tzaar-panel-edge),
            var(--tzaar-panel-shadow);
        color: var(--tzaar-ink);
        overflow: hidden;
    }

    .tray.active {
        box-shadow:
            inset 0 0 0 2px var(--tzaar-target),
            var(--tzaar-panel-shadow);
    }

    .body {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 12px;
    }

    .kind {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    /* Two digits wide, so both cards line up. */
    .kind strong {
        min-width: 2ch;
        font-size: 22px;
        text-align: end;
        font-variant-numeric: tabular-nums;
    }

    .kind.out strong {
        color: #b3261e;
    }

    .caption {
        margin-inline-start: auto;
        font-size: 13px;
        letter-spacing: 0.08em;
        color: var(--tzaar-ink-quiet);
    }
</style>
