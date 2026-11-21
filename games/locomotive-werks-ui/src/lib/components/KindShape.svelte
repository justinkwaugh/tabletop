<script lang="ts">
    import { LocomotiveKind } from '@tabletop/locomotive-werks'

    // A kind's shape, centred on (x, y) inside a square of the given size, for players who cannot
    // tell the kinds' colours apart.
    let {
        kind,
        x = 0,
        y = 0,
        size,
        fill = '#16140f'
    }: { kind: LocomotiveKind; x?: number; y?: number; size: number; fill?: string } = $props()

    const r = $derived(size / 2)
</script>

{#if kind === LocomotiveKind.Passenger}
    <circle class="kind-shape" cx={x} cy={y} r={r * 0.9} {fill}></circle>
{:else if kind === LocomotiveKind.Fast}
    <polygon
        class="kind-shape"
        points="{x},{y - r} {x + r},{y + r * 0.8} {x - r},{y + r * 0.8}"
        {fill}
    ></polygon>
{:else if kind === LocomotiveKind.Freight}
    <rect
        class="kind-shape"
        x={x - r * 0.82}
        y={y - r * 0.82}
        width={r * 1.64}
        height={r * 1.64}
        {fill}
    ></rect>
{:else}
    <polygon class="kind-shape" points="{x},{y - r} {x + r},{y} {x},{y + r} {x - r},{y}" {fill}
    ></polygon>
{/if}
