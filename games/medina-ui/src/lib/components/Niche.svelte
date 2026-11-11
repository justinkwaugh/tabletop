<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        height,
        rim,
        fill,
        children
    }: { height: 58; rim: string; fill: string; children?: Snippet } = $props()

    const outer = $derived(`M7 ${height}V38C1 20 14 3 33 3S65 20 59 38V${height}z`)
    const inner = $derived(`M13 ${height}V37C7 22 18 9 33 9S59 22 53 37V${height}z`)
</script>

<svg viewBox="0 0 66 {height}" class="niche" aria-hidden="true">
    <path class="rim" d={outer} fill={rim}></path>
    <path class="inner" d={inner} {fill}></path>
    <g clip-path="url(#medina-arch-{height})">
        {@render children?.()}
    </g>
</svg>

<style>
    .niche {
        display: block;
        width: 100%;
    }
</style>
