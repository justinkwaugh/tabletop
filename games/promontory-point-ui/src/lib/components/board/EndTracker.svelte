<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'
    import { townTileImage } from '$lib/images/tileImages.js'
    import { BAG_COUNT_X, END_TRACKER_ROWS } from '$lib/utils/boardGeometry.js'
    import type { EndTrackerStatus } from '$lib/utils/boardLayout.js'
    import {
        TOWN_TILE_ROTATION,
        endTrackerLines,
        localHexPoints,
        pointsAttribute
    } from '$lib/utils/boardLayout.js'
    import StripCard from './StripCard.svelte'

    let {
        status,
        bagRemaining,
        box
    }: { status: EndTrackerStatus; bagRemaining: number; box: BoundingBox } = $props()

    const uid = $props.id()
    const clipId = `pp-end-tracker-${uid}`
    const icon = pointsAttribute(localHexPoints(0.36))
    const tickX = 68
    const tickRadius = 30
    const iconX = 152
    const textX = 212
    const redTile = townTileImage('tile.red.dividend')
    const lines = $derived(endTrackerLines(status))
</script>

<!-- R-6.1, R-6.1-H1: the game ends after a turn once both lines are ticked; R-6.1-H2: or once
     the bag runs out, its count at the foot. A tick is a ✓ in a filled ring, never colour alone. -->
<g
    data-end-tracker
    data-red-tiles-uncovered={status.redTilesUncovered}
    data-red-tiles-met={status.redTilesMet}
    data-promontory-taken={status.promontoryTaken}
>
    <StripCard {box} title="GAME ENDS WHEN BOTH">
        <defs>
            <clipPath id={clipId}>
                <polygon points={icon}></polygon>
            </clipPath>
        </defs>
        {#each lines as line (line.key)}
            {@const y = END_TRACKER_ROWS[line.key]}
            <g data-end-condition={line.key} data-met={line.met}>
                <g
                    transform="translate({tickX} {y})"
                    role="img"
                    aria-label={line.met ? 'met' : 'not met'}
                    data-end-tick={line.met ? 'met' : 'open'}
                >
                    {#if line.met}
                        <circle r={tickRadius} fill="var(--pp-ok)"></circle>
                        <path
                            d="M-14 1 L-4 12 L15 -11"
                            fill="none"
                            stroke="var(--pp-rr-ink)"
                            stroke-width="8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        ></path>
                    {:else}
                        <circle
                            r={tickRadius - 3}
                            fill="none"
                            stroke="var(--pp-ink-sub)"
                            stroke-width="6"
                        ></circle>
                    {/if}
                </g>
                <g transform="translate({iconX} {y})">
                    {#if line.key === 'red'}
                        <g clip-path="url(#{clipId})">
                            <image
                                href={redTile.src}
                                x="-46"
                                y="-46"
                                width="92"
                                height="92"
                                transform="rotate({TOWN_TILE_ROTATION})"
                                data-end-icon="red"
                            ></image>
                        </g>
                    {:else}
                        <polygon
                            points={icon}
                            fill="var(--pp-charcoal)"
                            stroke="var(--pp-ink)"
                            stroke-width="5"
                        ></polygon>
                    {/if}
                </g>
                <text
                    x={textX}
                    {y}
                    class="pp-board-line"
                    font-size="48"
                    fill="var(--pp-ink)"
                    data-end-line={line.key}>{line.text}</text
                >
            </g>
        {/each}

        <!-- The other way the game ends. -->
        <g data-end-or>
            <line
                x1="50"
                x2={box.width / 2 - 50}
                y1={END_TRACKER_ROWS.or}
                y2={END_TRACKER_ROWS.or}
                stroke="var(--pp-brown)"
                stroke-opacity="0.6"
                stroke-width="4"
            ></line>
            <text
                x={box.width / 2}
                y={END_TRACKER_ROWS.or}
                class="pp-board-figure pp-board-italic"
                font-size="46"
                fill="var(--pp-ink-sub)">or</text
            >
            <line
                x1={box.width / 2 + 50}
                x2={box.width - 50}
                y1={END_TRACKER_ROWS.or}
                y2={END_TRACKER_ROWS.or}
                stroke="var(--pp-brown)"
                stroke-opacity="0.6"
                stroke-width="4"
            ></line>
        </g>

        <!-- R-1.3, R-5: the bag shows how many pieces are left, never which. -->
        <g data-bag={bagRemaining}>
            <text
                x={BAG_COUNT_X}
                y={END_TRACKER_ROWS.bag}
                class="pp-board-figure"
                font-size="120"
                fill="var(--pp-ink)"
                data-bag-count>{bagRemaining}</text
            >
            <text
                x={textX + 20}
                y={END_TRACKER_ROWS.bag - 28}
                class="pp-board-line pp-board-italic"
                font-size="46"
                fill="var(--pp-ink-sub)">{bagRemaining === 1 ? 'piece left' : 'pieces left'}</text
            >
            <text
                x={textX + 20}
                y={END_TRACKER_ROWS.bag + 30}
                class="pp-board-line pp-board-italic"
                font-size="46"
                fill="var(--pp-ink-sub)">in the bag</text
            >
        </g>
    </StripCard>
</g>
