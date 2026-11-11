<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        MARK_HEIGHT,
        MARK_PAPER,
        MARK_WIDTH,
        TAG_HEIGHT,
        approachSymbolScale
    } from '$lib/utils/approachSymbols.js'
    import PrintedMark from './PrintedMark.svelte'

    const gameSession = getGameSession()

    const scale = $derived(approachSymbolScale(gameSession.zoom))
</script>

<g class="pointer-events-none">
    {#each gameSession.approachSymbolTags as tag (tag.key)}
        <g
            transform="translate({tag.centre.x} {tag.centre.y}) rotate({tag.angle}) scale({scale})"
            data-symbol-tag={tag.key}
            data-slid={tag.slid ? '' : undefined}
        >
            <rect
                x={-tag.width / 2}
                y={-TAG_HEIGHT / 2}
                width={tag.width}
                height={TAG_HEIGHT}
                fill={MARK_PAPER}
            ></rect>
            {#each tag.marks as { mark, left } (left)}
                <g transform="translate({left} {-MARK_HEIGHT / 2})">
                    <PrintedMark {mark} width={MARK_WIDTH} height={MARK_HEIGHT} />
                </g>
            {/each}
        </g>
    {/each}
</g>
