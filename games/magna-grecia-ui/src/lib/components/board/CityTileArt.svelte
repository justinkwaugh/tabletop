<script lang="ts">
    import { localHexPoints } from '$lib/utils/boardGeometry.js'
    import { darken, lighten } from '$lib/utils/colorMix.js'

    let {
        color,
        variant = 0,
        ghost = false
    }: { color: string; variant?: number; ghost?: boolean } = $props()

    const tileShape = localHexPoints(1.5)
    const ground = $derived(lighten(color, 0.08))
    const edge = $derived(darken(color, 0.5))
    const roof = $derived(darken(color, 0.4))

    const HOUSE_LAYOUTS = [
        [
            { x: -21, y: -4, r: 0 },
            { x: 20, y: -6, r: 0 },
            { x: -14, y: 17, r: 0 },
            { x: 15, y: 16, r: 0 },
            { x: 0, y: 26, r: 0 }
        ],
        [
            { x: -22, y: 6, r: 0 },
            { x: 21, y: 4, r: 0 },
            { x: -10, y: 21, r: 0 },
            { x: 12, y: 22, r: 0 },
            { x: 0, y: -27, r: 0 }
        ]
    ]
    const houses = $derived(HOUSE_LAYOUTS[variant % HOUSE_LAYOUTS.length])
</script>

<g opacity={ghost ? 0.7 : 1}>
    <polygon points={tileShape} fill={ground} stroke={edge} stroke-width="3"></polygon>
    {#each houses as house, index (index)}
        <g transform="translate({house.x} {house.y})">
            <rect
                x="-6"
                y="-4"
                width="12"
                height="9"
                rx="1"
                fill={color}
                stroke={edge}
                stroke-width="0.7"
            ></rect>
            <rect
                x="-6.8"
                y="-6.6"
                width="13.6"
                height="4.4"
                rx="1"
                fill={roof}
                stroke="rgba(0,0,0,0.45)"
                stroke-width="0.6"
            ></rect>
        </g>
    {/each}
    <g transform="translate(0 -3)">
        <rect x="-13" y="6" width="26" height="4" fill="#fbf8f1" stroke="#6d6457" stroke-width="0.7"
        ></rect>
        <rect
            x="-11"
            y="-8"
            width="22"
            height="14"
            fill="#fbf8f1"
            stroke="#6d6457"
            stroke-width="0.7"
        ></rect>
        <g stroke="#b3aa99" stroke-width="1.3">
            <line x1="-7" y1="-7" x2="-7" y2="5"></line>
            <line x1="-2.3" y1="-7" x2="-2.3" y2="5"></line>
            <line x1="2.3" y1="-7" x2="2.3" y2="5"></line>
            <line x1="7" y1="-7" x2="7" y2="5"></line>
        </g>
        <path
            d="M -14 -8 L 0 -17 L 14 -8 Z"
            fill={color}
            stroke="rgba(0,0,0,0.45)"
            stroke-width="0.7"
        ></path>
    </g>
</g>
