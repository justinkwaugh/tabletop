<script lang="ts">
    import type { RailroadId } from '@tabletop/promontory-point'
    import { HandPointer } from '$lib/model/handPointer.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { turnPanel } from '$lib/model/turnPanel.js'
    import { HandSlotKind, yourHand } from '$lib/model/yourHand.js'
    import TrackPiece from './board/TrackPiece.svelte'

    const gameSession = getGameSession()
    const pointer = new HandPointer(gameSession)

    const PIECE_RADIUS = 17

    const hand = $derived(
        yourHand(turnPanel(gameSession), gameSession.gameState, gameSession.myPlayer?.id)
    )
</script>

{#snippet piece(railroadId: RailroadId)}
    <svg
        width={PIECE_RADIUS * 2 + 6}
        height={PIECE_RADIUS * 2 + 9}
        viewBox="{-PIECE_RADIUS - 3} {-PIECE_RADIUS - 3} {PIECE_RADIUS * 2 + 6} {PIECE_RADIUS * 2 +
            9}"
        aria-hidden="true"
        data-turn-piece-art
    >
        <TrackPiece {railroadId} radius={PIECE_RADIUS} />
    </svg>
{/snippet}

<!-- Contract, "Phone layout": the hand in a bar right under the board, within thumb reach. In
     the viewer's turn a press picks a piece (O-2); outside it, its next hand, dimmed. -->
{#if hand}
    <section class="bar" class:dimmed={hand.dimmed} data-your-hand data-dimmed={hand.dimmed}>
        <div class="heading">{hand.heading}</div>
        <div
            class="flex items-start gap-1"
            role="group"
            aria-label={hand.dimmed ? 'Your next pieces' : 'Turn pieces'}
        >
            {#each hand.slots as slot, index (index)}
                {#if slot.kind === HandSlotKind.Placed}
                    <div class="slot" data-hand-slot={index}>
                        <svg width="40" height="43" viewBox="-20 -20 40 43" aria-hidden="true">
                            <circle
                                r={PIECE_RADIUS}
                                data-piece-disc
                                fill="var(--pp-hidden)"
                                opacity="0.45"
                            ></circle>
                        </svg>
                        <span>placed</span>
                    </div>
                {:else if hand.dimmed}
                    <div
                        class="slot resting"
                        data-hand-slot={index}
                        data-own-piece={slot.railroadId}
                    >
                        {@render piece(slot.railroadId)}
                        <span
                            >{slot.tag}{#if slot.kept}&nbsp;· kept{/if}</span
                        >
                    </div>
                {:else}
                    <button
                        type="button"
                        class="slot"
                        class:picked={slot.picked}
                        data-hand-slot={index}
                        data-turn-piece={slot.railroadId}
                        disabled={!slot.pickable}
                        aria-pressed={slot.picked}
                        aria-label="{slot.tag} piece{slot.noRoom ? ', no room' : ''}"
                        onclick={() => gameSession.pressPiece(slot.railroadId)}
                        onpointerenter={(event) => pointer.enter(event, slot.railroadId)}
                        onpointerleave={(event) => pointer.leave(event)}
                        onfocus={(event) => pointer.focus(event, slot.railroadId)}
                        onblur={() => pointer.blur()}
                    >
                        {@render piece(slot.railroadId)}
                        <!-- Each slot is one width, so a pick never shifts the pieces beside it. -->
                        <span class="label"
                            >{slot.tag}{#if slot.picked}&nbsp;· picked{/if}</span
                        >
                        {#if slot.noRoom}
                            <span class="no-room">no room</span>
                        {/if}
                    </button>
                {/if}
            {/each}
            {#if hand.note}
                <span class="note">{hand.note}</span>
            {/if}
        </div>
    </section>
{/if}

<style>
    .bar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
        padding: 4px 10px;
        background: var(--pp-paper);
        color: var(--pp-ink);
        border-top: 3px solid var(--pp-accent);
        border-radius: 0 0 4px 4px;
    }

    .bar.dimmed {
        border-top-color: var(--pp-paper-line);
    }

    .heading {
        width: 64px;
        flex: none;
        font-family: Oswald, sans-serif;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.2;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--pp-brown);
    }

    .slot {
        display: flex;
        width: 62px;
        min-height: 44px;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        font-size: 10.5px;
        line-height: 1.1;
        color: var(--pp-ink-sub);
        border-radius: 6px;
    }

    .label {
        white-space: nowrap;
    }

    .dimmed .resting {
        opacity: 0.5;
    }

    button.slot:disabled {
        opacity: 0.6;
    }

    /* The ring carries the amber; the label stays in ink so it reads on paper. */
    .slot.picked {
        color: var(--pp-ink);
        font-weight: 700;
    }

    .slot.picked :global(svg) {
        border-radius: 50%;
        box-shadow:
            0 0 0 2px var(--pp-halo),
            0 0 0 5px var(--pp-accent),
            0 0 0 7px var(--pp-halo);
    }

    .no-room {
        color: var(--pp-ink);
        font-weight: 600;
    }

    .note {
        align-self: center;
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
        font-size: 13px;
        color: var(--pp-ink-sub);
    }
</style>
