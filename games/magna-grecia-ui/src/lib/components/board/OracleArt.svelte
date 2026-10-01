<script lang="ts">
    import { localHexPoints } from '$lib/utils/boardGeometry.js'

    let { angle = -90, attentionColor }: { angle?: number; attentionColor?: string } = $props()

    const plinthShape = localHexPoints(1.5)
    const trimShape = localHexPoints(6)
    const OUTLINE = '#11161d'
    const MARBLE = 'url(#mg-marble)'
    const FLUTES = [-5, -1.7, 1.7, 5]

    const accent = $derived(attentionColor ?? MARBLE)
</script>

<g>
    <polygon points={plinthShape} fill="#fbf9f4" stroke="#8f8779" stroke-width="1.6"></polygon>
    <polygon
        points={trimShape}
        fill="none"
        stroke="#c9c2b4"
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
        <rect x="-32" y="-13" width="5" height="26" rx="1" fill={accent} stroke-width="1.6"></rect>
        <rect x="-27" y="-11" width="4" height="22" fill={MARBLE} stroke-width="1.3"></rect>
        <rect x="-23" y="-9" width="26" height="18" fill={MARBLE} stroke-width="1.6"></rect>
        {#each FLUTES as y (y)}
            <line x1="-21" y1={y} x2="2" y2={y} stroke="#9a927f" stroke-width="1.2"></line>
        {/each}
        <rect x="3" y="-11" width="4" height="22" fill={MARBLE} stroke-width="1.3"></rect>
        <circle cx="5" cy="-12" r="3" fill={MARBLE} stroke-width="1.2"></circle>
        <circle cx="5" cy="12" r="3" fill={MARBLE} stroke-width="1.2"></circle>
        <rect x="7" y="-13" width="4" height="26" rx="0.8" fill={MARBLE} stroke-width="1.3"></rect>
        <path d="M 11 -21 L 33 0 L 11 21 Z" fill={accent} stroke-width="2"></path>
    </g>
</g>
