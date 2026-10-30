<script lang="ts">
    import type { RailroadId } from '@tabletop/promontory-point'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { TurnPanel } from '$lib/model/turnPanel.js'
    import TrackPiece from './board/TrackPiece.svelte'

    let { panel }: { panel: TurnPanel } = $props()

    const gameSession = getGameSession()

    const PIECE_RADIUS = 18

    function hover(event: PointerEvent, railroadId: RailroadId | undefined) {
        if (event.pointerType !== 'touch') {
            gameSession.hoverPiece(railroadId)
        }
    }
</script>

{#snippet piece(railroadId: RailroadId, radius: number)}
    <svg
        width={radius * 2 + 6}
        height={radius * 2 + 9}
        viewBox="{-radius - 3} {-radius - 3} {radius * 2 + 6} {radius * 2 + 9}"
        aria-hidden="true"
    >
        <TrackPiece {railroadId} {radius} />
    </svg>
{/snippet}

<section class="pieces pp-block shrink-0">
    <div class="pp-block-heading max-sm:hidden">{panel.piecesHeading}</div>
    <!-- O-2: a press picks a piece and lights its hexes; R-3.3: "no room" marks one with none. -->
    <div class="flex items-start gap-3" role="group" aria-label="Turn pieces">
        {#each { length: panel.placedCount }, index (index)}
            <div class="pp-piece-slot">
                <svg width="42" height="45" viewBox="-21 -21 42 45" aria-hidden="true">
                    <circle r={PIECE_RADIUS} fill="var(--pp-hidden)" opacity="0.45"></circle>
                </svg>
                <span>placed</span>
            </div>
        {/each}
        {#each panel.pieces as turnPiece, index (index)}
            <button
                type="button"
                class="pp-piece-slot"
                class:picked={turnPiece.picked}
                data-turn-piece={turnPiece.railroadId}
                disabled={!turnPiece.pickable}
                aria-pressed={turnPiece.picked}
                aria-label="{turnPiece.tag} piece{turnPiece.noRoom ? ', no room' : ''}"
                onclick={() => gameSession.pressPiece(turnPiece.railroadId)}
                onpointerenter={(event) => hover(event, turnPiece.railroadId)}
                onpointerleave={(event) => hover(event, undefined)}
                onfocus={() => gameSession.hoverPiece(turnPiece.railroadId)}
                onblur={() => gameSession.hoverPiece(undefined)}
            >
                {@render piece(turnPiece.railroadId, PIECE_RADIUS)}
                <span>
                    {turnPiece.tag}{#if turnPiece.picked}&nbsp;· picked{/if}
                </span>
                {#if turnPiece.noRoom}
                    <span class="pp-no-room">no room</span>
                {/if}
            </button>
        {/each}
    </div>

    {#if panel.setAside}
        <!-- R-3.3-H1, R-X.2: the scrap draws from the bag, so the button names that it is final. -->
        <div class="mt-2 flex max-w-80 flex-col gap-1">
            <button type="button" class="pp-button big" onclick={() => gameSession.scrapTrack()}
                >{panel.setAside.label}</button
            >
            {#if panel.setAside.keepNote}
                <p class="text-xs text-pp-muted">{panel.setAside.keepNote}</p>
            {/if}
        </div>
    {/if}

    {#if panel.endTurn.length > 0}
        <!-- R-2.2 step 4, R-6.3: End turn draws the next hand; the variant keeps or returns. -->
        <div class="mt-2 flex flex-wrap gap-2">
            {#each panel.endTurn as choice, index (choice.label)}
                <button
                    type="button"
                    class="pp-button big"
                    class:primary={index === 0}
                    onclick={() => gameSession.endTurn(choice.returnKeptPiece)}
                >
                    {#if choice.keptPiece}
                        {@render piece(choice.keptPiece, 8)}
                    {/if}
                    {choice.label}
                </button>
            {/each}
        </div>
    {/if}
</section>

<style>
    /* Contract, "Phone layout": the hand as a row of pieces with labels, without the block. */
    @media (width < 40rem) {
        section.pieces.pp-block {
            padding: 0;
            border: 0;
            background: none;
        }

        /* 34 px pieces. */
        .pp-piece-slot :global(svg) {
            width: 34px;
            height: auto;
        }

        .pp-piece-slot {
            min-height: 44px;
            font-size: 10.5px;
            line-height: 1.1;
        }
    }

    .pp-piece-slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        font-size: 11px;
        color: var(--pp-muted);
        border-radius: 6px;
    }

    button.pp-piece-slot:disabled {
        opacity: 0.6;
    }

    .pp-piece-slot.picked {
        color: var(--pp-accent);
        font-weight: 700;
    }

    .pp-piece-slot.picked :global(svg) {
        border-radius: 50%;
        box-shadow:
            0 0 0 2px var(--pp-halo),
            0 0 0 5px var(--pp-accent),
            0 0 0 7px var(--pp-halo);
    }

    .pp-no-room {
        color: var(--pp-text);
        font-weight: 600;
    }
</style>
