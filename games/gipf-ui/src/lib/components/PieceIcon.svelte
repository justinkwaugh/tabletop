<script lang="ts">
    import type { Color } from '@tabletop/common'
    import PieceShape from './PieceShape.svelte'

    let {
        color,
        gipf = false,
        size = 18
    }: { color: Color; gipf?: boolean; size?: number } = $props()
</script>

<svg
    width={size}
    height={size}
    viewBox="-12 -12 24 24"
    class="inline-block shrink-0"
    aria-hidden="true"
>
    <PieceShape {color} {gipf} radius={gipf ? 8.5 : 9.5} />
</svg>
