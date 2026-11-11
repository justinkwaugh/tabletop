<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MARK_INK, MARK_PAPER } from '$lib/utils/approachSymbols.js'
    import {
        CAPACITY_FONT_SIZE,
        CAPACITY_SQUARE_SIZE,
        CAPACITY_TAG_SIZE
    } from '$lib/utils/capacityTags.js'

    const gameSession = getGameSession()

    const LINE_WIDTH = 0.9

    const scale = $derived(gameSession.flagView.scale)
</script>

<g class="pointer-events-none">
    {#each gameSession.capacityTags as tag (tag.locale)}
        {@const { x, y } = tag.centre}
        <g
            transform="translate({x} {y}) rotate({-gameSession.boardRotation}) scale({scale})"
            data-capacity-tag={tag.locale}
            data-moved={tag.moved ? '' : undefined}
        >
            <rect
                x={-CAPACITY_TAG_SIZE / 2}
                y={-CAPACITY_TAG_SIZE / 2}
                width={CAPACITY_TAG_SIZE}
                height={CAPACITY_TAG_SIZE}
                fill={MARK_PAPER}
            ></rect>
            <rect
                x={-CAPACITY_SQUARE_SIZE / 2}
                y={-CAPACITY_SQUARE_SIZE / 2}
                width={CAPACITY_SQUARE_SIZE}
                height={CAPACITY_SQUARE_SIZE}
                fill="none"
                stroke={MARK_INK}
                stroke-width={LINE_WIDTH}
            ></rect>
            <text text-anchor="middle" dy="0.35em" font-size={CAPACITY_FONT_SIZE} fill={MARK_INK}
                >{tag.capacity}</text
            >
        </g>
    {/each}
</g>
