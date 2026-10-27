<script lang="ts">
    import { Resource } from '@tabletop/power-grid'

    let {
        resource,
        x = 0,
        y = 0,
        size = 14
    }: { resource: Resource; x?: number; y?: number; size?: number } = $props()

    const s = $derived(size / 2)
</script>

<!-- Matte wooden pieces: coal cubes, oil barrels, garbage drums, uranium rods. -->
<g transform="translate({x} {y})">
    <ellipse cx={s * 0.15} cy={s * 0.95} rx={s * 1.05} ry={s * 0.3} fill="#000" opacity="0.3"
    ></ellipse>
    {#if resource === Resource.Coal}
        <rect x={-s} y={-s} width={size} height={size} rx={s * 0.18} fill="#6e4a2c"></rect>
        <rect x={-s} y={-s} width={size} height={s * 0.55} rx={s * 0.18} fill="#87603d"></rect>
    {:else if resource === Resource.Oil}
        <rect x={-s * 0.85} y={-s} width={s * 1.7} height={size} rx={s * 0.45} fill="#1f1f22"
        ></rect>
        <rect x={-s * 0.85} y={-s * 0.42} width={s * 1.7} height={s * 0.16} fill="#4a4a50"></rect>
        <rect x={-s * 0.85} y={s * 0.3} width={s * 1.7} height={s * 0.16} fill="#4a4a50"></rect>
    {:else if resource === Resource.Garbage}
        <rect x={-s * 0.85} y={-s} width={s * 1.7} height={size} rx={s * 0.3} fill="#d9b32b"></rect>
        <rect x={-s * 0.85} y={-s} width={s * 1.7} height={s * 0.45} rx={s * 0.3} fill="#e8c949"
        ></rect>
    {:else}
        <rect x={-s * 0.6} y={-s} width={s * 1.2} height={size} rx={s * 0.6} fill="#c23526"></rect>
        <rect x={-s * 0.6} y={-s} width={s * 1.2} height={s * 0.7} rx={s * 0.6} fill="#d6503f"
        ></rect>
    {/if}
</g>
