<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import boardImg from '$lib/images/board.jpg'
    import GreenShip from '$lib/images/greenShip.svelte'
    import PurpleShip from '$lib/images/purpleShip.svelte'
    import boardImg5p from '$lib/images/board5p.jpg'

    let gameSession = getContext('gameSession') as SolGameSession

    function getCirclePoint(radius: number, angle: number) {
        return {
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
        }
    }

    function toRadians(degrees: number) {
        return degrees * (Math.PI / 180)
    }

    function drawSection(
        innerRadius: number,
        outerRadius: number,
        startDegrees: number,
        endDegrees: number
    ) {
        const startAngle = toRadians(startDegrees)
        const endAngle = toRadians(endDegrees)
        const start = getCirclePoint(innerRadius, startAngle)
        const end = getCirclePoint(innerRadius, endAngle)
        const startOuter = getCirclePoint(outerRadius, startAngle)
        const endOuter = getCirclePoint(outerRadius, endAngle)
        return `M${start.x} ${start.y} L${startOuter.x} ${startOuter.y} A${outerRadius} ${outerRadius} 0 0 1 ${endOuter.x} ${endOuter.y} L${end.x} ${end.y} A${innerRadius} ${innerRadius} 0 0 0 ${start.x} ${start.y}Z`
    }

    const INNER_CORE_RADIUS = 48
    const OUTER_CORE_RADIUS = 143
    const INNER_RADIATIVE_RADIUS = 153
    const OUTER_RADIATIVE_RADIUS = 256
    const INNER_CONVECTIVE_RADIUS = 266
    const OUTER_CONVECTIVE_RADIUS = 359
    const INNER_INNER_ORBIT_RADIUS = 368
    const OUTER_INNER_ORBIT_RADIUS = 462
    const INNER_OUTER_ORBIT_RADIUS = 483
    const OUTER_OUTER_ORBIT_RADIUS = 574

    const cells = [
        [INNER_CORE_RADIUS, OUTER_CORE_RADIUS, 15, 83],
        [INNER_CORE_RADIUS, OUTER_CORE_RADIUS, 83, 150],
        [INNER_CORE_RADIUS, OUTER_CORE_RADIUS, 150, 225],
        [INNER_CORE_RADIUS, OUTER_CORE_RADIUS, 225, 297],
        [INNER_CORE_RADIUS, OUTER_CORE_RADIUS, 297, 15],
        [INNER_RADIATIVE_RADIUS, OUTER_RADIATIVE_RADIUS, 15, 59],
        [INNER_RADIATIVE_RADIUS, OUTER_RADIATIVE_RADIUS, 60, 104],
        [INNER_RADIATIVE_RADIUS, OUTER_RADIATIVE_RADIUS, 105, 149],
        [INNER_RADIATIVE_RADIUS, OUTER_RADIATIVE_RADIUS, 150, 192],
        [INNER_RADIATIVE_RADIUS, OUTER_RADIATIVE_RADIUS, 193, 238.5],
        [INNER_RADIATIVE_RADIUS, OUTER_RADIATIVE_RADIUS, 239.5, 283.5],
        [INNER_RADIATIVE_RADIUS, OUTER_RADIATIVE_RADIUS, 284.5, 330.5],
        [INNER_RADIATIVE_RADIUS, OUTER_RADIATIVE_RADIUS, 331.5, 14],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 27, 54],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 55, 81.5],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 82.5, 109],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 110, 136.5],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 137.5, 164.5],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 165.5, 192],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 193, 219.5],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 220.5, 247.5],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 248.5, 275],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 276, 302.5],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 303.5, 330.5],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 331.5, 358.5],
        [INNER_CONVECTIVE_RADIUS, OUTER_CONVECTIVE_RADIUS, 359.5, 26],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 11.5, 38.25],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 39.25, 66],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 67, 93.75],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 94.75, 121.5],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 122.5, 149.25],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 150.25, 176.75],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 177.75, 204.5],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 205.5, 232],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 233, 259.5],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 260.5, 287.25],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 288.25, 315],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 316, 342.75],
        [INNER_INNER_ORBIT_RADIUS, OUTER_INNER_ORBIT_RADIUS, 343.75, 10.5],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 11.5, 38.25],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 39.25, 66],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 67, 93.75],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 94.75, 121.5],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 122.5, 149.25],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 150.25, 176.75],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 177.75, 204.5],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 205.5, 232],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 233, 259.5],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 260.5, 287.25],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 288.25, 315],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 316, 342.75],
        [INNER_OUTER_ORBIT_RADIUS, OUTER_OUTER_ORBIT_RADIUS, 343.75, 10.5]
    ]
</script>

<div class="relative w-[1280px] h-[1280px]">
    <div class="absolute top left w-[1280px] h-[1280px]">
        <img src={boardImg} alt="game board" />
    </div>
    <svg class="absolute z-10" width="1280" height="1280" viewBox="0 0 1280 1280">
        <!-- {#each cells as [innerRadius, outerRadius, startDegrees, endDegrees]}
            <g transform="translate(639,640)" stroke="#FFF" stroke-width="4">
                <path
                    d={drawSection(innerRadius, outerRadius, startDegrees, endDegrees)}
                    fill="transparent"
                ></path>
            </g>
        {/each} -->

        <g
            transform="translate(480, 0) translate(639, 640) scale(.5) rotate(0) translate(-100,-200)"
        >
            <GreenShip />
        </g>

        <g
            transform="translate(-480, 0) translate(639,640) scale(.5) rotate(180) translate(-84, -200)"
        >
            <PurpleShip />
        </g>
    </svg>
</div>
