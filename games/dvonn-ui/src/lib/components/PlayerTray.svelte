<script lang="ts">
    import { MachineState, PIECES_PER_PLAYER, type HydratedDvonnPlayerState } from '@tabletop/dvonn'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PIECE_RADIUS, stackBounds } from '$lib/board/pieceGeometry.js'
    import StackShape from './StackShape.svelte'

    let { playerState }: { playerState: HydratedDvonnPlayerState } = $props()

    const session = getGameSession()

    const isActive = $derived(session.gameState.activePlayerIds.includes(playerState.playerId))
    const isWinner = $derived(
        session.gameState.result !== undefined &&
            session.gameState.winningPlayerIds.includes(playerState.playerId)
    )
    const tone = $derived(session.toneOfPlayer(playerState.playerId))
    const placing = $derived(session.gameState.machineState === MachineState.PlacingPieces)

    // While placing, the pieces still in hand; after, the pieces in stacks the player controls,
    // which is the score (rule G2).
    const count = $derived(
        placing
            ? PIECES_PER_PLAYER - session.gameState.board.piecesOf(playerState.playerId)
            : session.gameState.score(playerState.playerId)
    )
    const caption = $derived(placing ? 'to place' : 'controlled')

    const ICON_PIECES = 3
    const bounds = stackBounds(ICON_PIECES, PIECE_RADIUS)
    const reach = PIECE_RADIUS + 1
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
        <svg
            width="34"
            height="34"
            viewBox="{-reach} {bounds.top - 1} {reach * 2} {bounds.bottom - bounds.top + 2}"
            aria-hidden="true"
        >
            <StackShape
                tones={Array.from({ length: ICON_PIECES }, () => tone)}
                seedKeys={Array.from(
                    { length: ICON_PIECES },
                    (_, index) => `tray-${playerState.playerId}-${index}`
                )}
                radius={PIECE_RADIUS}
                showCount={false}
            />
        </svg>
        <strong>{count}</strong>
        <span class="caption">{caption}</span>
    </div>
</div>

<style>
    /* Light enough for black pieces to stand out as well as white ones. */
    .tray {
        --ring: 1px;
        border-radius: 12px;
        background: #d8d3c6;
        box-shadow:
            inset 0 0 0 var(--ring) #a69f8e,
            0 3px 8px rgb(0 0 0 / 0.3);
        color: #1d1a14;
        overflow: hidden;
    }

    .tray.active {
        --ring: 2px;
        box-shadow:
            inset 0 0 0 var(--ring) var(--dvonn-target),
            0 3px 8px rgb(0 0 0 / 0.35);
    }

    .body {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 12px;
    }

    .body strong {
        font-size: 22px;
        font-variant-numeric: tabular-nums;
    }

    .caption {
        font-size: 13px;
        letter-spacing: 0.08em;
        color: #5b5446;
    }
</style>
