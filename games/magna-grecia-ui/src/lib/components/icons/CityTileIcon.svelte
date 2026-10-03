<script lang="ts">
    import TempleArt from '../board/TempleArt.svelte'

    let { size = 24, color = '#c0673f' }: { size?: number; color?: string } = $props()
</script>

<svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true">
    <polygon
        points="0,-11 9.5,-5.5 9.5,5.5 0,11 -9.5,5.5 -9.5,-5.5"
        fill={color}
        stroke="#1d1a17"
        stroke-width="0.8"
    ></polygon>
    <g transform="translate(0 0.6) scale(0.42)">
        <TempleArt {color} />
    </g>
</svg>
