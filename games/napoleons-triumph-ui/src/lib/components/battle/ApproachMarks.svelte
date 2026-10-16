<script lang="ts">
    import type { PrintedMark } from '$lib/map/boardGeometry.js'
    import { MARK_HEIGHT, MARK_WIDTH, markRow } from '$lib/utils/approachSymbols.js'
    import PrintedMarkDrawing from '../board/PrintedMark.svelte'

    let { marks }: { marks: readonly PrintedMark[] } = $props()

    const OUTLINE_BLEED = 1

    const row = $derived(markRow(marks))
</script>

<svg
    class="nt-approach-marks"
    viewBox="{-OUTLINE_BLEED} {-OUTLINE_BLEED} {row.width + OUTLINE_BLEED * 2} {MARK_HEIGHT +
        OUTLINE_BLEED * 2}"
    aria-hidden="true"
    data-approach-marks={marks.join('')}
>
    {#each row.marks as { mark, left } (left)}
        <g transform="translate({left} 0)">
            <PrintedMarkDrawing {mark} width={MARK_WIDTH} height={MARK_HEIGHT} />
        </g>
    {/each}
</svg>

<style>
    .nt-approach-marks {
        display: inline-block;
        height: 0.8em;
        width: auto;
        margin-left: 0.25em;
        vertical-align: -0.05em;
    }
</style>
