<script lang="ts">
    import {
        DVONN_PIECES,
        MachineState,
        PIECES_PER_PLAYER,
        type HydratedDvonnPlayerState
    } from '@tabletop/dvonn'
    import { seedKeyOf, toneOf } from '$lib/board/pieceStyle.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PIECE_RADIUS, stackBounds, TILT } from '$lib/board/pieceGeometry.js'
    import { controlledTally, inStacks, TALLY_HEIGHT } from '$lib/board/tally.js'
    import { CONTACT_SHADE, holeFloor, throughLens } from '$lib/board/pieceShape.js'
    import PieceDefs from './PieceDefs.svelte'
    import StackShape from './StackShape.svelte'

    let { playerState }: { playerState: HydratedDvonnPlayerState } = $props()

    const session = getGameSession()

    const isActive = $derived(session.gameState.activePlayerIds.includes(playerState.playerId))
    const isWinner = $derived(
        session.gameState.result !== undefined &&
            session.gameState.winningPlayerIds.includes(playerState.playerId)
    )
    const placing = $derived(session.gameState.machineState === MachineState.PlacingPieces)

    // While placing, the pieces still in hand, both colours on the setter's card in I set, you
    // choose; after, the pieces in stacks the player controls,
    // which is the score (rule G2).
    const hand = $derived(placing ? session.handOf(playerState.playerId) : [])
    const count = $derived(placing ? hand.length : session.gameState.score(playerState.playerId))
    const caption = $derived(placing ? 'left' : 'high')
    // Both captions take the wider one's room, so the tally keeps its size when placing ends.
    const CAPTIONS = ['left', 'high']

    // The same pieces as stacks: the pieces in hand, or each controlled piece itself.
    const tally = $derived(
        placing
            ? inStacks(
                  // Numbered within each colour, so placing one keeps the others' looks.
                  hand.map((color, index) => ({
                      tone: toneOf(color),
                      seedKey: `hand-${playerState.playerId}-${color}-${index - hand.indexOf(color)}`
                  }))
              )
            : controlledTally(session.gameState.board.stacks, playerState.playerId).map((stack) =>
                  stack.map((piece) => ({
                      tone: session.toneOfPiece(piece),
                      seedKey: seedKeyOf(piece)
                  }))
              )
    )

    const prefix = $derived(`dvonn-card-${playerState.playerId}`)
    const RADIUS = PIECE_RADIUS
    // Down a short stack's hole, the card in the stack's shade, lighter than around it.
    const HOLE_FLOOR = holeFloor(CONTACT_SHADE)
    const PITCH = RADIUS * 2 + 5
    const bounds = stackBounds(TALLY_HEIGHT, RADIUS)
    const tallyHeight = bounds.bottom - bounds.top + 2
    // Room for every piece in the game, laid out right-aligned, so a tally is drawn at the same size
    // on both cards whatever it holds, and the largest still fits beside the count.
    const MOST_STACKS = Math.ceil((PIECES_PER_PLAYER * 2 + DVONN_PIECES) / TALLY_HEIGHT)
    const tallyWidth = (MOST_STACKS - 1) * PITCH + RADIUS * 2 + 2
    const tallyLeft = $derived((tally.length - MOST_STACKS) * PITCH - RADIUS - 1)
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
        <strong>{count}</strong>
        <span class="caption">
            {#each CAPTIONS as word (word)}
                <span class:unseen={word !== caption} aria-hidden={word !== caption}>{word}</span>
            {/each}
        </span>
        {#if tally.length > 0}
            <svg
                class="tally"
                viewBox="{tallyLeft} {bounds.top - 1} {tallyWidth} {tallyHeight}"
                preserveAspectRatio="xMaxYMid meet"
                aria-hidden="true"
            >
                <defs><PieceDefs {prefix} radius={RADIUS} /></defs>
                {#each tally as stack, index (index)}
                    {@const through = throughLens(stack.length, RADIUS)}
                    <g transform="translate({index * PITCH} 0)">
                        <ellipse
                            rx={RADIUS}
                            ry={RADIUS * TILT}
                            fill="url(#{prefix}-contact)"
                            clip-path={through
                                ? `url(#${prefix}-around-hole-${stack.length})`
                                : undefined}
                        ></ellipse>
                        {#if through}
                            <path d={through} fill="#000000" fill-opacity={HOLE_FLOOR}></path>
                        {/if}
                        <StackShape
                            {prefix}
                            tones={stack.map((piece) => piece.tone)}
                            seedKeys={stack.map((piece) => piece.seedKey)}
                            radius={RADIUS}
                        />
                    </g>
                {/each}
            </svg>
        {/if}
    </div>
</div>

<style>
    /* Sand like the action card, light enough for black pieces to stand out as well as white ones. */
    .tray {
        border-radius: 12px;
        background: var(--dvonn-panel);
        box-shadow:
            inset 0 0 0 1px var(--dvonn-panel-edge),
            var(--dvonn-panel-shadow);
        color: var(--dvonn-ink);
        overflow: hidden;
    }

    .tray.active {
        box-shadow:
            inset 0 0 0 2px var(--dvonn-target),
            var(--dvonn-panel-shadow);
    }

    .body {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
    }

    /* Two digits wide, so both cards' captions line up. */
    .body strong {
        min-width: 2ch;
        font-size: 22px;
        text-align: end;
        font-variant-numeric: tabular-nums;
    }

    .tally {
        flex: 1;
        min-width: 0;
        max-height: 56px;
    }

    .caption {
        display: inline-grid;
        font-size: 13px;
        letter-spacing: 0.08em;
        color: var(--dvonn-ink-quiet);
    }

    .caption > span {
        grid-area: 1 / 1;
    }

    .caption .unseen {
        visibility: hidden;
    }
</style>
