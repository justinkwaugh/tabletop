<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import boardImg from '$lib/images/board.jpg'
    import GreenShip from '$lib/images/greenShip.svelte'
    import PurpleShip from '$lib/images/purpleShip.svelte'
    import SilverShip from '$lib/images/silverShip.svelte'
    import BlackShip from '$lib/images/blackShip.svelte'
    import BlueShip from '$lib/images/blueShip.svelte'
    import Sundiver from '$lib/images/sundiver.svelte'
    import Tower from '$lib/images/tower.svelte'
    import boardImg5p from '$lib/images/board5p.jpg'
    import { SolGraph } from '@tabletop/sol'
    import { dimensionsForSpace } from '$lib/utils/boardGeometry.js'

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

    function getMothershipTranslation(angle: number) {
        const radius = 470
        const point = getCirclePoint(radius, toRadians(angle))
        return `translate(${point.x}, ${point.y})`
    }

    const dimensions = new SolGraph(4).map((node) => dimensionsForSpace(4, node.coords))
</script>

<div class="relative w-[1280px] h-[1280px]">
    <div class="absolute top left w-[1280px] h-[1280px]">
        <img src={boardImg} alt="game board" />
    </div>
    <svg class="absolute z-10" width="1280" height="1280" viewBox="0 0 1280 1280">
        <defs>
            <filter id="textshadow" width="130%" height="130%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1 1" result="shadow"
                ></feGaussianBlur>
                <feOffset dx="2" dy="2"></feOffset>
            </filter>
        </defs>

        <!-- {#each cells as [innerRadius, outerRadius, startDegrees, endDegrees]}
            <g transform="translate(639,640)" stroke="#FFF" stroke-width="2">
                <path
                    d={drawSection(innerRadius, outerRadius, startDegrees, endDegrees)}
                    fill="transparent"
                ></path>
            </g>
        {/each} -->

        {#each dimensions as dimension, i}
            {#if i % 5 !== 0}
                <g transform="translate(639,640)" stroke="none">
                    <path
                        d={drawSection(
                            dimension.innerRadius,
                            dimension.outerRadius,
                            dimension.startDegrees,
                            dimension.endDegrees
                        )}
                        opacity="0.5"
                        fill="black"
                    ></path>
                </g>
            {/if}
        {/each}

        <g
            transform="{getMothershipTranslation(
                55
            )} translate(639, 640) scale(.4) rotate(55) translate(-100,-200)"
        >
            <GreenShip />
        </g>

        <g
            transform="{getMothershipTranslation(
                55
            )} translate(639,640) scale(.4) rotate(55) translate(-84, -200)"
        >
            <PurpleShip />
        </g>
        <g
            transform="{getMothershipTranslation(
                55
            )} translate(639,640) scale(.4) rotate(55) translate(-122, -200)"
        >
            <SilverShip />
        </g>
        <g
            transform="{getMothershipTranslation(
                55
            )} translate(639,640) scale(.4) rotate(55) translate(-92, -200)"
        >
            <BlackShip />
        </g>
        <g
            transform="{getMothershipTranslation(
                55
            )} translate(639,640) scale(.4) rotate(55) translate(-132, -200)"
        >
            <BlueShip />
        </g>

        <g transform="translate(70, 0) translate(639,640) scale(.8) translate(-19, -25)">
            <Sundiver />
        </g>
        <g transform="translate(100, 0) translate(639,640) scale(.8) translate(-19, -25)">
            <Sundiver />
        </g>
        <g transform="translate(100, 0) translate(639,640)">
            <text
                class="select-none"
                style="filter: url(#textshadow); fill: black"
                y="1"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="23"
                font-weight="bold"
                stroke-width="1"
                stroke="#000000"
                opacity=".5"
                fill="black">2</text
            >
            <text
                y="1"
                class="select-none"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="23"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >2
            </text>
        </g>

        <g transform="translate(130, 0) translate(639,640) scale(.8) translate(-19, -25)">
            <Sundiver />
        </g>
        <g transform="translate(130, 0) translate(639,640)">
            <text
                class="select-none"
                style="filter: url(#textshadow); fill: black"
                y="1"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="23"
                font-weight="bold"
                stroke-width="1"
                stroke="#000000"
                opacity=".5"
                fill="black">3</text
            >
            <text
                y="1"
                class="select-none"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="23"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >3
            </text>
        </g>

        <g transform="translate(80, -40) translate(639,640) scale(.8) translate(-19, -25)">
            <Sundiver />
        </g>
        <g transform="translate(80, -40) translate(639,640)">
            <text
                class="select-none"
                style="filter: url(#textshadow); fill: black"
                y="1"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="23"
                font-weight="bold"
                stroke-width="1"
                stroke="#000000"
                opacity=".5"
                fill="black">4</text
            >
            <text
                y="1"
                class="select-none"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="23"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >4
            </text>
        </g>

        <g transform="translate(110, -40) translate(639,640) scale(.8) translate(-19, -25)">
            <Sundiver />
        </g>
        <g transform="translate(110, -40) translate(639,640)">
            <text
                class="select-none"
                style="filter: url(#textshadow); fill: black"
                y="1"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="23"
                font-weight="bold"
                stroke-width="1"
                stroke="#000000"
                opacity=".5"
                fill="black">5</text
            >
            <text
                y="1"
                class="select-none"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="23"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >5
            </text>
        </g>
        <g transform="translate(70, 70) translate(639,640) scale(.9) translate(-24, -50)">
            <Tower />
        </g>
    </svg>
</div>
