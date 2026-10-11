<script lang="ts">
    import UnitSymbol from '$lib/components/UnitSymbol.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        DIAGONAL_BAR,
        MARK_HEIGHT,
        MARK_WIDTH,
        PENALISED_UNIT_TYPE,
        SYMBOL_TAGS,
        TAG_HEIGHT,
        approachSymbolScale,
        tagCentre
    } from '$lib/utils/approachSymbols.js'

    const gameSession = getGameSession()

    const INK = '#2b2620'
    const PAPER = '#f1ecdc'
    const LINE_WIDTH = 1.2

    const scale = $derived(approachSymbolScale(gameSession.zoom))
</script>

{#snippet diagonalBar(rising: boolean)}
    <rect
        transform="translate({MARK_WIDTH / 2} {MARK_HEIGHT / 2}) rotate({rising
            ? -DIAGONAL_BAR.angle
            : DIAGONAL_BAR.angle})"
        x={-DIAGONAL_BAR.length / 2}
        y={-DIAGONAL_BAR.thickness / 2}
        width={DIAGONAL_BAR.length}
        height={DIAGONAL_BAR.thickness}
        fill={PAPER}
        stroke={INK}
        stroke-width={LINE_WIDTH}
    ></rect>
{/snippet}

{#if gameSession.approachSymbolsShown}
    <g class="pointer-events-none">
        {#each SYMBOL_TAGS as tag (tag.key)}
            {@const centre = tagCentre(tag, scale)}
            <g transform="translate({centre.x} {centre.y}) rotate({tag.angle}) scale({scale})">
                <rect
                    x={-tag.width / 2}
                    y={-TAG_HEIGHT / 2}
                    width={tag.width}
                    height={TAG_HEIGHT}
                    rx="2"
                    fill={PAPER}
                    stroke={INK}
                    stroke-width="0.8"
                ></rect>
                {#each tag.marks as { mark, left } (left)}
                    {@const penalised = PENALISED_UNIT_TYPE[mark]}
                    <g transform="translate({left} {-MARK_HEIGHT / 2})">
                        {#if penalised !== undefined}
                            <UnitSymbol
                                type={penalised}
                                width={MARK_WIDTH}
                                height={MARK_HEIGHT}
                                ink={INK}
                                lineWidth={LINE_WIDTH}
                                dotRadius={MARK_HEIGHT / 3}
                                hollowDot
                            />
                        {:else}
                            {@render diagonalBar(true)}
                            {#if mark === 'X'}
                                {@render diagonalBar(false)}
                            {/if}
                        {/if}
                    </g>
                {/each}
            </g>
        {/each}
    </g>
{/if}
