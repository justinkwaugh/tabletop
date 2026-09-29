<script lang="ts">
    import { localHexPoints } from '$lib/utils/boardGeometry.js'

    let { angle = -90, attentionColor }: { angle?: number; attentionColor?: string } = $props()

    const plinthShape = localHexPoints(1.5)
    const trimShape = localHexPoints(6)
    const ARROW = 'M -26 -7 L 6 -7 L 6 -17 L 30 0 L 6 17 L 6 7 L -26 7 Z'
</script>

<g>
    <polygon points={plinthShape} fill="#3d4a5c" stroke="#262f3b" stroke-width="1.4"></polygon>
    <polygon
        points={trimShape}
        fill="none"
        stroke="#8e9bb0"
        stroke-width="1.5"
        stroke-dasharray="4 3"
        stroke-linejoin="round"
    ></polygon>
    <g transform="rotate({angle})">
        <path
            d={ARROW}
            filter="url(#mg-tile-shadow)"
            fill={attentionColor ?? 'url(#mg-marble)'}
            stroke="#11161d"
            stroke-width="2"
            stroke-linejoin="round"
        ></path>
    </g>
</g>
