<script lang="ts">
    import { localHexPoints } from '$lib/utils/boardGeometry.js'
    import { mixColor } from '$lib/utils/colorMix.js'

    let {
        color,
        founding = false,
        ghost = false
    }: { color: string; founding?: boolean; ghost?: boolean } = $props()

    type House = { x: number; y: number; rotation: number; length: number }

    const OUTLINE = '#1d1a17'
    const WIDE = 12
    const NARROW = 9
    // Tone-on-tone: small houses and temple in tints of the player colour keep the tile mostly
    // that colour; the whole house drawing, outline included, is scaled down.
    const HOUSE_SCALE = 0.66
    const TEMPLE_SCALE = 0.7
    const groundShape = localHexPoints(1.5)
    const bandShape = localHexPoints(4.4)

    // Houses on a ring face the centre: their roof strip is on the outer side.
    function ring(count: number, radius: number, isWide: (index: number) => boolean): House[] {
        return Array.from({ length: count }, (_, index) => {
            const angle = -90 + (index * 360) / count
            const radians = (angle * Math.PI) / 180
            return {
                x: radius * Math.cos(radians),
                y: radius * Math.sin(radians),
                rotation: angle + 90,
                length: isWide(index) ? WIDE : NARROW
            }
        })
    }

    const FOUNDING_HOUSES = ring(8, 24, (index) => index % 2 === 0)
    const EXTENSION_HOUSES: House[] = [
        ...ring(7, 23, (index) => index % 3 === 0),
        { x: -6 * HOUSE_SCALE, y: -2 * HOUSE_SCALE, rotation: 20, length: WIDE },
        { x: 7 * HOUSE_SCALE, y: 5 * HOUSE_SCALE, rotation: -35, length: WIDE }
    ]

    const band = $derived(mixColor(color, '#000000', 0.22))
    const keyline = $derived(mixColor(color, '#000000', 0.1))
    const roof = $derived(mixColor(color, '#000000', 0.45))
    const body = $derived(mixColor(color, '#ffffff', 0.2))
    const columns = $derived(mixColor(color, '#000000', 0.35))
    const houses = $derived(founding ? FOUNDING_HOUSES : EXTENSION_HOUSES)
</script>

<g opacity={ghost ? 0.7 : 1}>
    <polygon points={groundShape} fill={color} stroke={OUTLINE} stroke-width="1.2"></polygon>
    <polygon points={bandShape} fill="none" stroke={band} stroke-width="4.4"></polygon>
    <polygon points={bandShape} fill="none" stroke={keyline} stroke-width="1.2"></polygon>
    <g stroke={OUTLINE} stroke-width="0.7" stroke-linejoin="round">
        {#each houses as house, index (index)}
            <g
                transform="translate({house.x} {house.y}) rotate({house.rotation}) scale({HOUSE_SCALE})"
            >
                <rect
                    x={-house.length / 2}
                    y="-6"
                    width={house.length}
                    height="4"
                    rx="0.8"
                    fill={roof}
                ></rect>
                <rect
                    x={-house.length / 2}
                    y="-2"
                    width={house.length}
                    height="8"
                    rx="0.8"
                    fill={body}
                ></rect>
            </g>
        {/each}
        {#if founding}
            <g transform="translate(0 2) scale({TEMPLE_SCALE})">
                <rect x="-13" y="6" width="26" height="4" fill={roof}></rect>
                <rect x="-11" y="-8" width="22" height="14" fill={body}></rect>
                <path
                    d="M -7 -6 V 4 M -3.5 -6 V 4 M 0 -6 V 4 M 3.5 -6 V 4 M 7 -6 V 4"
                    stroke={columns}
                ></path>
                <rect x="-12" y="-11" width="24" height="3" fill={roof}></rect>
                <path d="M -13 -11 L 0 -18 L 13 -11 Z" fill={roof}></path>
            </g>
        {/if}
    </g>
</g>
