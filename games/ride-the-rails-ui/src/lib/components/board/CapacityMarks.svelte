<script lang="ts">
    import { USA_CITIES, USA_HEXES } from '@tabletop/ride-the-rails'
    import { HEX_SIZE, HEX_WIDTH, hexCenter } from '$lib/utils/boardGeometry.js'

    const SIDE = 20
    const GAP = 6
    const CHICAGO_EXTRA = 9

    // R-4.1.3, R-4.1.4: the cities with a printed limit other than two: an East Coast city holds a
    // single locomotive, Chicago any number, and so at most six, one per railroad.
    const limited = USA_CITIES.flatMap((city) =>
        city.capacity === 1
            ? [{ city, text: '1' }]
            : city.capacity === 'unlimited'
              ? [{ city, text: '6' }]
              : []
    )

    const landCenters = USA_HEXES.map((hex) => hexCenter(hex.id))

    // The sides of a hex, towards each neighbour, east first, then round by the north.
    const SIDES = [0, -60, -120, 180, 120, 60].map((degrees) => (degrees * Math.PI) / 180)

    function isWater(x: number, y: number): boolean {
        return !landCenters.some((land) => Math.hypot(land.x - x, land.y - y) < HEX_SIZE / 2)
    }

    // Each mark stands in the water just past the first side of its city with no land beyond.
    const marks = limited.map(({ city, text }) => {
        const center = hexCenter(city.hexId)
        const side =
            SIDES.find((angle) =>
                isWater(
                    center.x + Math.cos(angle) * HEX_WIDTH,
                    center.y + Math.sin(angle) * HEX_WIDTH
                )
            ) ?? 0
        // Chicago's 6 stands further out, clear of the passenger in its hex's top right.
        const distance = HEX_WIDTH / 2 + GAP + SIDE / 2 + (text === '6' ? CHICAGO_EXTRA : 0)
        return {
            cityId: city.id,
            text,
            x: center.x + Math.cos(side) * distance,
            y: center.y + Math.sin(side) * distance
        }
    })
</script>

<!-- R-4.1.3, R-4.1.4: beside each city with its own limit, in the water, a white outline of a cube
     with the most locomotives it holds: 1 on the East Coast, 6 at Chicago. -->
<g class="capacity-marks" aria-hidden="true" data-capacity-marks>
    {#each marks as mark (mark.cityId)}
        <g transform="translate({mark.x} {mark.y})">
            <rect
                x={-SIDE / 2}
                y={-SIDE / 2}
                width={SIDE}
                height={SIDE}
                rx="3"
                fill="none"
                stroke="var(--rtr-white)"
                stroke-width="2"
            ></rect>
            <text
                class="rtr-serif"
                y="5.2"
                text-anchor="middle"
                font-size="15"
                fill="var(--rtr-white)">{mark.text}</text
            >
        </g>
    {/each}
</g>
