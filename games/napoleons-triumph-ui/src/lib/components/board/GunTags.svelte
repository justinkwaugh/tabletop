<script lang="ts">
    import { UnitType } from '@tabletop/napoleons-triumph'
    import UnitSymbol from '$lib/components/UnitSymbol.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MARK_INK, MARK_PAPER } from '$lib/utils/approachSymbols.js'
    import { BLOCK_SYMBOL_HEIGHT, BLOCK_SYMBOL_WIDTH } from '$lib/utils/faceLayout.js'
    import {
        GUN_TAG_FONT_SIZE,
        GUN_TAG_HEIGHT,
        GUN_TAG_PADDING,
        GUN_TAG_STRIPE,
        GUN_TAG_TEXT_LEFT
    } from '$lib/utils/gunTags.js'

    const gameSession = getGameSession()

    const LINE_WIDTH = 1.2
</script>

<g class="pointer-events-none">
    {#each gameSession.gunTags as { approach, playerId, text, angle, box } (`${playerId}:${approach}`)}
        {@const width = box.halfLength * 2}
        <g
            transform="translate({box.centre.x} {box.centre.y}) rotate({angle}) translate({-width /
                2} {-GUN_TAG_HEIGHT / 2})"
            data-gun-tag={approach}
        >
            <rect {width} height={GUN_TAG_HEIGHT} fill={MARK_PAPER}></rect>
            {#if playerId}
                <rect
                    width={GUN_TAG_STRIPE}
                    height={GUN_TAG_HEIGHT}
                    fill={gameSession.armyColors(playerId).block}
                ></rect>
            {/if}
            <g
                transform="translate({GUN_TAG_STRIPE + GUN_TAG_PADDING} {(GUN_TAG_HEIGHT -
                    BLOCK_SYMBOL_HEIGHT) /
                    2})"
            >
                <UnitSymbol
                    type={UnitType.Artillery}
                    width={BLOCK_SYMBOL_WIDTH}
                    height={BLOCK_SYMBOL_HEIGHT}
                    ink={MARK_INK}
                    lineWidth={LINE_WIDTH}
                    dotRadius={BLOCK_SYMBOL_HEIGHT / 4}
                />
            </g>
            <text
                x={GUN_TAG_TEXT_LEFT}
                y={GUN_TAG_HEIGHT / 2}
                dy="0.35em"
                font-size={GUN_TAG_FONT_SIZE}
                fill={MARK_INK}>{text}</text
            >
        </g>
    {/each}
</g>
