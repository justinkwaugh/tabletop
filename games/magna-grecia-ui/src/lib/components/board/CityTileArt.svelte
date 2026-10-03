<script lang="ts">
    import { localHexPoints } from '$lib/utils/boardGeometry.js'
    import { mixColor } from '$lib/utils/colorMix.js'

    let {
        color,
        founding = false,
        ghost = false
    }: { color: string; founding?: boolean; ghost?: boolean } = $props()

    type House = { x: number; y: number; rotation: number; length: number; tiles: string }

    const OUTLINE = '#1d1a17'
    const WATER = '#4a90b8'
    const WATER_GLINT = '#d8eef6'
    const WIDE = 12
    const NARROW = 9
    const TILE_PITCH = 1.5
    const groundShape = localHexPoints(1.5)
    const bandShape = localHexPoints(4.4)

    // The roof's tile courses: lines across the roof, ending in a scalloped eave.
    function roofTiles(length: number): string {
        const start = -length / 2
        let path = ''
        for (let x = start + TILE_PITCH; x < length / 2 - 0.5; x += TILE_PITCH) {
            path += `M ${x.toFixed(2)} -6.6 V -1.4 `
        }
        path += `M ${start} -1.4`
        for (let x = start; x < length / 2 - 0.01; x += TILE_PITCH) {
            path += ` q 0.75 1 ${TILE_PITCH} 0`
        }
        return path
    }

    function house(x: number, y: number, rotation: number, length: number): House {
        return { x, y, rotation, length, tiles: roofTiles(length) }
    }

    // Houses on a ring face the centre: their tiled roof is on the outer side.
    function ring(count: number, radius: number, isWide: (index: number) => boolean): House[] {
        return Array.from({ length: count }, (_, index) => {
            const angle = -90 + (index * 360) / count
            const radians = (angle * Math.PI) / 180
            return house(
                radius * Math.cos(radians),
                radius * Math.sin(radians),
                angle + 90,
                isWide(index) ? WIDE : NARROW
            )
        })
    }

    const FOUNDING_HOUSES = ring(8, 27, (index) => index % 2 === 0)
    const EXTENSION_HOUSES: House[] = [
        ...ring(7, 26, (index) => index % 3 === 0),
        house(-6, -2, 20, WIDE),
        house(7, 5, -35, WIDE)
    ]
    const PAVING_JOINTS =
        'M -12 -6 H 12 M -12 0 H 12 M -12 6 H 12 M -6 -12 V 12 M 0 -12 V 12 M 6 -12 V 12'

    const band = $derived(mixColor(color, '#000000', 0.22))
    const keyline = $derived(mixColor(color, '#ffffff', 0.5))
    const wall = $derived(mixColor(color, '#ffffff', 0.55))
    const roof = $derived(mixColor(color, '#000000', 0.38))
    const roofLines = $derived(mixColor(color, '#000000', 0.6))
    const ridge = $derived(mixColor(color, '#000000', 0.15))
    const paving = $derived(mixColor(color, '#ffffff', 0.62))
    const joints = $derived(mixColor(color, '#000000', 0.18))
    const basin = $derived(mixColor(color, '#ffffff', 0.75))
    const houses = $derived(founding ? FOUNDING_HOUSES : EXTENSION_HOUSES)
</script>

<g opacity={ghost ? 0.7 : 1}>
    <polygon points={groundShape} fill={color} stroke={OUTLINE} stroke-width="1.2"></polygon>
    <polygon points={bandShape} fill="none" stroke={band} stroke-width="4.4"></polygon>
    <polygon points={bandShape} fill="none" stroke={keyline} stroke-width="1.2"></polygon>
    <g stroke={OUTLINE} stroke-width="0.7" stroke-linejoin="round">
        {#each houses as house, index (index)}
            {@const start = -house.length / 2}
            <g transform="translate({house.x} {house.y}) rotate({house.rotation})">
                <rect x={start} y="-1.5" width={house.length} height="7.5" rx="0.8" fill={wall}
                ></rect>
                <rect
                    x={start - 0.6}
                    y="-7"
                    width={house.length + 1.2}
                    height="6"
                    rx="0.9"
                    fill={roof}
                ></rect>
                <path d={house.tiles} fill="none" stroke={roofLines} stroke-width="0.55"></path>
                <path
                    d="M {start - 0.2} -6.2 H {house.length / 2 + 0.2}"
                    stroke={ridge}
                    stroke-width="0.9"
                ></path>
            </g>
        {/each}
    </g>
    {#if founding}
        <!-- The founding tile's agora: a paved square with a fountain. -->
        <g transform="translate(0 1) scale(1.05)" stroke-linejoin="round">
            <rect
                x="-12"
                y="-12"
                width="24"
                height="24"
                rx="1.2"
                fill={paving}
                stroke={OUTLINE}
                stroke-width="0.8"
            ></rect>
            <path d={PAVING_JOINTS} stroke={joints} stroke-width="0.45"></path>
            <circle r="6.2" fill={basin} stroke={OUTLINE} stroke-width="0.8"></circle>
            <circle r="4.3" fill={WATER} stroke={OUTLINE} stroke-width="0.6"></circle>
            <circle r="1.4" fill={WATER_GLINT}></circle>
        </g>
    {/if}
</g>
