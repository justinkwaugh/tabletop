<script lang="ts">
    import { RAILROADS, type RailroadId } from '@tabletop/promontory-point'
    import { HandPointer } from '$lib/model/handPointer.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { turnPanel } from '$lib/model/turnPanel.js'
    import { HandSlotKind, yourHand } from '$lib/model/yourHand.js'
    import { STRIP_SLOTS, handSlotCentres } from '$lib/utils/boardGeometry.js'
    import StripCard from './StripCard.svelte'
    import TrackPiece from './TrackPiece.svelte'

    const gameSession = getGameSession()
    const pointer = new HandPointer(gameSession)
    // Contract, "Phone layout": a phone draws the hand in a bar under the board instead.
    const layout = new PhoneLayout()

    const hand = $derived(
        yourHand(turnPanel(gameSession), gameSession.gameState, gameSession.myPlayer?.id)
    )
    const row = $derived(handSlotCentres(hand?.slots.length ?? 0))
    const box = STRIP_SLOTS.hand
    const labelGap = 46

    // A piece the seat may not pick now (the variant's leftover after three placements) takes no
    // press, as the phone bar's disabled button does.
    function press(slot: { railroadId: RailroadId; pickable: boolean }) {
        if (slot.pickable) gameSession.pressPiece(slot.railroadId)
    }

    function onKey(event: KeyboardEvent, slot: { railroadId: RailroadId; pickable: boolean }) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            press(slot)
        }
    }
</script>

<!-- Contract, "Your hand": the viewer's pieces at the top of the strip, nearest the board. In
     its turn a press picks a piece and lights its hexes (O-2); outside it, its next hand, dimmed. -->
{#if hand && !layout.phone}
    <g data-your-hand data-dimmed={hand.dimmed} class:dimmed={hand.dimmed}>
        <StripCard {box} title={hand.heading.toUpperCase()} />
        <g role="group" aria-label={hand.dimmed ? 'Your next pieces' : 'Turn pieces'}>
            {#each hand.slots as slot, index (index)}
                {@const centre = row.centres[index]}
                {@const radius = row.radius}
                {#if slot.kind === HandSlotKind.Placed}
                    <g transform="translate({centre.x} {centre.y})" data-hand-slot={index}>
                        <circle r={radius} data-piece-disc fill="var(--pp-hidden)" opacity="0.45"
                        ></circle>
                        <text
                            y={radius + labelGap}
                            class="pp-board-figure pp-board-italic"
                            font-size="38"
                            fill="var(--pp-ink-sub)">placed</text
                        >
                    </g>
                {:else if hand.dimmed}
                    <g
                        transform="translate({centre.x} {centre.y})"
                        class="resting"
                        data-hand-slot={index}
                        data-own-piece={slot.railroadId}
                    >
                        <g data-turn-piece-art
                            ><TrackPiece railroadId={slot.railroadId} {radius} /></g
                        >
                        <text
                            y={radius + labelGap}
                            class="pp-board-figure"
                            font-size="40"
                            fill="var(--pp-ink-sub)">{slot.tag}</text
                        >
                        {#if slot.kept}
                            <text
                                y={radius + labelGap * 2}
                                class="pp-board-figure pp-board-italic"
                                font-size="36"
                                fill="var(--pp-ink-sub)">kept</text
                            >
                        {/if}
                    </g>
                {:else}
                    <g
                        transform="translate({centre.x} {centre.y})"
                        role="button"
                        tabindex={slot.pickable ? 0 : -1}
                        aria-pressed={slot.picked}
                        aria-disabled={!slot.pickable}
                        aria-label="{slot.tag} piece{slot.noRoom ? ', no room' : ''}"
                        class="piece"
                        class:picked={slot.picked}
                        class:pickable={slot.pickable}
                        data-hand-slot={index}
                        data-turn-piece={slot.railroadId}
                        onclick={() => press(slot)}
                        onkeydown={(event) => onKey(event, slot)}
                        onpointerenter={(event) => pointer.enter(event, slot.railroadId)}
                        onpointerleave={(event) => pointer.leave(event)}
                        onfocus={(event) => pointer.focus(event, slot.railroadId)}
                        onblur={() => pointer.blur()}
                    >
                        <rect
                            x={-radius - 14}
                            y={-radius - 14}
                            width={2 * radius + 28}
                            height={2 * radius + labelGap * 2 + 40}
                            fill="transparent"
                        ></rect>
                        <circle class="focus-ring" r={radius + 22} fill="none" stroke-width="6"
                        ></circle>
                        {#if slot.picked}
                            <!-- Pick conventions: the picked piece carries the heavier amber ring. -->
                            <circle
                                r={radius + 12}
                                fill="none"
                                stroke="var(--pp-halo)"
                                stroke-width="18"
                            ></circle>
                            <circle
                                r={radius + 12}
                                fill="none"
                                stroke="var(--pp-accent)"
                                stroke-width="10"
                            ></circle>
                        {/if}
                        <g data-turn-piece-art>
                            <title>{RAILROADS[slot.railroadId].name} track piece</title>
                            <TrackPiece railroadId={slot.railroadId} {radius} />
                        </g>
                        <text
                            y={radius + labelGap}
                            class="pp-board-figure"
                            font-size="40"
                            fill="var(--pp-ink)"
                            font-weight={slot.picked ? 700 : 500}>{slot.tag}</text
                        >
                        {#if slot.picked || slot.noRoom}
                            <text
                                y={radius + labelGap * 2}
                                class="pp-board-figure pp-board-italic"
                                font-size="36"
                                fill="var(--pp-ink)"
                                >{slot.picked ? 'picked' : ''}{slot.picked && slot.noRoom
                                    ? ' · '
                                    : ''}{slot.noRoom ? 'no room' : ''}</text
                            >
                        {/if}
                    </g>
                {/if}
            {/each}
        </g>
        {#if hand.note}
            <text
                x={box.x + box.width / 2}
                y={box.y + 210}
                class="pp-board-figure pp-board-italic"
                font-size="44"
                fill="var(--pp-ink-sub)">{hand.note}</text
            >
        {/if}
    </g>
{/if}

<style>
    /* Outside the viewer's turn the hand rests, dimmed, and takes no press. */
    .dimmed .resting {
        opacity: 0.5;
    }

    .piece {
        outline: none;
    }

    .piece.pickable {
        cursor: pointer;
    }

    .piece[aria-disabled='true'] {
        opacity: 0.6;
    }

    .focus-ring {
        stroke: transparent;
    }

    .piece:focus-visible .focus-ring {
        stroke: var(--pp-accent);
    }
</style>
