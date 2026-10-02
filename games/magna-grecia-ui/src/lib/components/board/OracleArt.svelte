<script lang="ts">
    import { localHexPoints } from '$lib/utils/boardGeometry.js'

    let { angle = -90, attentionColor }: { angle?: number; attentionColor?: string } = $props()

    const plinthShape = localHexPoints(1.5)
    const trimShape = localHexPoints(6)
    const OUTLINE = '#11161d'
    const WHITE = '#fbf9f4'

    // The temple is drawn pointing up; `angle` is the screen direction to the favoured city.
    const rotation = $derived(angle + 90)
    const accent = $derived(attentionColor ?? WHITE)
</script>

<g>
    <polygon
        points={plinthShape}
        fill="#ecdcae"
        stroke="#b8954a"
        stroke-width="1.6"
        stroke-linejoin="round"
    ></polygon>
    <polygon
        points={trimShape}
        fill="none"
        stroke="#cdb27a"
        stroke-width="1.2"
        stroke-dasharray="4 3"
        stroke-linejoin="round"
    ></polygon>
    <g transform="rotate({rotation})">
        <!-- Shifted so the figure's centroid, not its bounding box, sits on the tile centre. -->
        <g
            transform="translate(-0.05 -1.05)"
            stroke={OUTLINE}
            stroke-linejoin="round"
            filter="url(#mg-tile-shadow)"
        >
            <rect x="-19" y="14" width="38" height="5" rx="0.6" fill={accent} stroke-width="1.3"
            ></rect>
            <rect x="-16" y="10" width="32" height="4" rx="0.6" fill={accent} stroke-width="1.3"
            ></rect>
            <rect x="-9" y="-8.5" width="18" height="18.5" fill={WHITE} stroke-width="1"></rect>
            <rect x="-3" y="-1" width="6" height="11" fill={accent} stroke-width="0.9"></rect>
            <rect x="-11.25" y="-6" width="5.5" height="16" fill={WHITE} stroke-width="1.2"></rect>
            <rect x="5.75" y="-6" width="5.5" height="16" fill={WHITE} stroke-width="1.2"></rect>
            <rect
                x="-12.75"
                y="-8.5"
                width="8.5"
                height="2.5"
                rx="0.8"
                fill={WHITE}
                stroke-width="1"
            ></rect>
            <rect x="4.25" y="-8.5" width="8.5" height="2.5" rx="0.8" fill={WHITE} stroke-width="1"
            ></rect>
            <rect x="-15" y="-13" width="30" height="4.5" rx="0.6" fill={accent} stroke-width="1.3"
            ></rect>
            <polygon points="-15,-13 0,-23 15,-13" fill={accent} stroke-width="1.8"></polygon>
        </g>
    </g>
</g>
