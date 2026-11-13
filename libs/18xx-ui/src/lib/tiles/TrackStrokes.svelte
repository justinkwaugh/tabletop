<script lang="ts">
    import type { TrackStroke } from './trackGaugeStrokes.js'

    let { d, strokes }: { d: string; strokes: readonly TrackStroke[] } = $props()
</script>

{#each strokes as stroke, index (index)}
    <path
        {d}
        stroke={stroke.color}
        stroke-width={stroke.width}
        stroke-dasharray={stroke.dasharray}
        stroke-linecap={stroke.linecap}
    ></path>
{/each}
