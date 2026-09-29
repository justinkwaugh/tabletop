<script lang="ts">
    import { localHexPoints } from '$lib/utils/boardGeometry.js'

    let { angle = -90, attentionColor }: { angle?: number; attentionColor?: string } = $props()

    const plinthShape = localHexPoints(1.5)
    const trimShape = localHexPoints(6)
    const OUTLINE = '#11161d'
    const MARBLE = 'url(#mg-marble)'
    const FLUTES = [-3.2, 0, 3.2]

    const accent = $derived(attentionColor ?? MARBLE)
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
    <g
        transform="rotate({angle})"
        stroke={OUTLINE}
        stroke-linejoin="round"
        filter="url(#mg-tile-shadow)"
    >
        <rect x="-31" y="-11" width="4" height="22" rx="0.8" fill={accent} stroke-width="1.4"
        ></rect>
        <rect x="-27" y="-8.5" width="4" height="17" rx="0.6" fill={MARBLE} stroke-width="1.2"
        ></rect>
        <rect x="-23" y="-6" width="27" height="12" fill={MARBLE} stroke-width="1.4"></rect>
        {#each FLUTES as y (y)}
            <line x1="-21" y1={y} x2="2" y2={y} stroke="#9a927f" stroke-width="1"></line>
        {/each}
        <rect x="4" y="-8.5" width="4" height="17" rx="0.6" fill={MARBLE} stroke-width="1.2"
        ></rect>
        <circle cx="6" cy="-9.5" r="2.6" fill={MARBLE} stroke-width="1.1"></circle>
        <circle cx="6" cy="9.5" r="2.6" fill={MARBLE} stroke-width="1.1"></circle>
        <rect x="8" y="-11" width="3" height="22" rx="0.6" fill={MARBLE} stroke-width="1.2"
        ></rect>
        <path d="M 11 -16 L 32 0 L 11 16 Z" fill={accent} stroke-width="1.8"></path>
        <path
            d="M 14 -9 L 25 0 L 14 9 Z"
            fill="none"
            stroke={OUTLINE}
            stroke-opacity="0.45"
            stroke-width="1"
        ></path>
    </g>
</g>
