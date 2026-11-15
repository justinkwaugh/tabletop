<script lang="ts">
    import TileArt from './TileArt.svelte'

    let {
        name,
        title,
        pixelHeight = 28
    }: { name: string; title: string; pixelHeight?: number } = $props()

    const EDGE = 0.045
    const PAD = 0.05
</script>

<svg
    class="chip"
    height={pixelHeight}
    width={pixelHeight}
    viewBox="{-0.5 - PAD} {-0.5 - PAD} {1 + 2 * PAD} {1 + 2 * PAD}"
    role="img"
>
    <title>{title}</title>
    <rect
        x={-0.5 - EDGE}
        y={-0.5 - EDGE}
        width={1 + 2 * EDGE}
        height={1 + 2 * EDGE}
        rx="0.05"
        fill="#e6c595"
    ></rect>
    <TileArt {name} size={1} />
</svg>

<style>
    .chip {
        display: block;
        flex: none;
    }
</style>
