<script lang="ts">
    import {
        CENTER_POINT,
        getCirclePoint,
        getGatePosition,
        getMothershipAngle,
        getSpaceCentroid,
        MOTHERSHIP_OFFSETS,
        MOTHERSHIP_RADIUS,
        toRadians,
        translateFromCenter,
        type GatePosition
    } from '$lib/utils/boardGeometry.js'
    import Sundiver from './Sundiver.svelte'
    import Gate from './Gate.svelte'
    import Tower from './Tower.svelte'
    import BlueShip from '$lib/images/blueShip.svelte'
    import SilverShip from '$lib/images/silverShip.svelte'
    import { Direction, Ring, SolGraph } from '@tabletop/sol'
    import { Color, type Point } from '@tabletop/common'
    import { nanoid } from 'nanoid'
    import GreenShip from '$lib/images/greenShip.svelte'
    import PurpleShip from '$lib/images/purpleShip.svelte'
    import BlackShip from '$lib/images/blackShip.svelte'
    import { CELL_LAYOUT_5P } from '$lib/utils/cellLayout5p.js'

    enum PieceType {
        Sundiver,
        Tower
    }
    const numPlayers = 5

    console.log(getCirclePoint(148, toRadians(45)))

    let hideStuff: boolean = $state(false)
    let currentType: PieceType = $state(PieceType.Sundiver)

    const gatePositions: GatePosition[] = []
    const graph = new SolGraph(numPlayers)
    for (const node of graph) {
        if (
            node.coords.row === Ring.Inner ||
            node.coords.row === Ring.Convective ||
            node.coords.row === Ring.Radiative
        ) {
            for (const neighbor of graph.neighborsOf(node.coords, Direction.In)) {
                gatePositions.push(getGatePosition(numPlayers, neighbor.coords, node.coords))
            }
        }
    }

    const spaceLabels: { point: Point; label: string }[] = []
    for (const node of graph) {
        spaceLabels.push({
            point: getSpaceCentroid(numPlayers, node.coords),
            label: `[${node.coords.row}, ${node.coords.col}]`
        })
    }

    const blueOffsets = MOTHERSHIP_OFFSETS[Color.Blue]
    const grayOffsets = MOTHERSHIP_OFFSETS[Color.Gray]
    const greenOffsets = MOTHERSHIP_OFFSETS[Color.Green]
    const purpleOffsets = MOTHERSHIP_OFFSETS[Color.Purple]
    const blackOffsets = MOTHERSHIP_OFFSETS[Color.Black]
    let blueShapeTransformation = `translate(${MOTHERSHIP_RADIUS}, 0), translate(${CENTER_POINT.x}, ${CENTER_POINT.y}) scale(.35) rotate(${blueOffsets.rotation}) translate(${blueOffsets.x},${blueOffsets.y})`
    let grayShapeTransformation = `translate(${MOTHERSHIP_RADIUS}, 0), translate(${CENTER_POINT.x}, ${CENTER_POINT.y}) scale(.35) rotate(${grayOffsets.rotation}) translate(${grayOffsets.x},${grayOffsets.y})`
    let greenShapeTransformation = `translate(${MOTHERSHIP_RADIUS}, 0), translate(${CENTER_POINT.x}, ${CENTER_POINT.y}) scale(.35) rotate(${greenOffsets.rotation}) translate(${greenOffsets.x},${greenOffsets.y})`
    let purpleShapeTransformation = `translate(${MOTHERSHIP_RADIUS}, 0), translate(${CENTER_POINT.x}, ${CENTER_POINT.y}) scale(.35) rotate(${purpleOffsets.rotation}) translate(${purpleOffsets.x},${purpleOffsets.y})`
    let blackShapeTransformation = `translate(${MOTHERSHIP_RADIUS}, 0), translate(${CENTER_POINT.x}, ${CENTER_POINT.y}) scale(.35) rotate(${blackOffsets.rotation}) translate(${blackOffsets.x},${blackOffsets.y})`

    const blueLocations: string[] = []
    for (let i = 0; i < (numPlayers === 5 ? 16 : 13); i++) {
        blueLocations.push(
            `rotate(${getMothershipAngle(numPlayers, Color.Blue, i)}, ${CENTER_POINT.x}, ${CENTER_POINT.y})`
        )
    }

    const grayLocations: string[] = []
    for (let i = 0; i < (numPlayers === 5 ? 16 : 13); i++) {
        grayLocations.push(
            `rotate(${getMothershipAngle(numPlayers, Color.Gray, i)}, ${CENTER_POINT.x}, ${CENTER_POINT.y})`
        )
    }

    const greenLocations: string[] = []
    for (let i = 0; i < (numPlayers === 5 ? 16 : 13); i++) {
        greenLocations.push(
            `rotate(${getMothershipAngle(numPlayers, Color.Green, i)}, ${CENTER_POINT.x}, ${CENTER_POINT.y})`
        )
    }

    const purpleLocations: string[] = []
    for (let i = 0; i < (numPlayers === 5 ? 16 : 13); i++) {
        purpleLocations.push(
            `rotate(${getMothershipAngle(numPlayers, Color.Purple, i)}, ${CENTER_POINT.x}, ${CENTER_POINT.y})`
        )
    }

    const blackLocations: string[] = []
    for (let i = 0; i < (numPlayers === 5 ? 16 : 13); i++) {
        blackLocations.push(
            `rotate(${getMothershipAngle(numPlayers, Color.Black, i)}, ${CENTER_POINT.x}, ${CENTER_POINT.y})`
        )
    }

    const tempDiversLocations: { id: string; point: Point }[] = $state([])
    const tempTowersLocations: { id: string; point: Point }[] = $state([])

    function onClick(event) {
        if (currentType === PieceType.Sundiver) {
            tempDiversLocations.push({
                id: nanoid(),
                point: { x: event.offsetX - 639, y: event.offsetY - 640 }
            })
        } else {
            tempTowersLocations.push({
                id: nanoid(),
                point: { x: event.offsetX - 639, y: event.offsetY - 640 }
            })
        }
    }

    function diverClick(id: string) {
        tempDiversLocations.splice(
            tempDiversLocations.findIndex((diver) => diver.id === id),
            1
        )
    }

    function towerClick(id: string) {
        tempTowersLocations.splice(
            tempTowersLocations.findIndex((diver) => diver.id === id),
            1
        )
    }

    function chooseSundiver() {
        currentType = PieceType.Sundiver
    }

    function chooseTower() {
        currentType = PieceType.Tower
    }
</script>

{#if !hideStuff}
    {#each spaceLabels as { point, label }}
        <text
            transform={translateFromCenter(point.x + 1, point.y + 1)}
            text-anchor="middle"
            font-size="21"
            font-weight="bold"
            opacity=".5"
            fill="black">{label}</text
        >
        <text
            transform={translateFromCenter(point.x, point.y)}
            text-anchor="middle"
            font-size="20"
            font-weight="bold"
            fill="white"
        >
            {label}
        </text>
    {/each}

    <!-- <Sundiver color="green" quantity={1} location={{ x: -70, y: 0 }} />
<Sundiver color="gray" quantity={1} location={{ x: 70, y: 0 }} />
<Sundiver color="gray" quantity={2} location={{ x: 100, y: 0 }} />
<Sundiver color="green" quantity={3} location={{ x: 130, y: 0 }} />
<Sundiver color="blue" quantity={4} location={{ x: 80, y: -40 }} />
<Sundiver color="purple" quantity={5} location={{ x: 110, y: -40 }} /> -->

    <!-- <g transform="{translateFromCenter(70, 70)} scale(.9) translate(-24, -50)">
        <Tower />
    </g> -->

    {#each gatePositions as gatePosition}
        <Gate color="green" {...gatePosition} />
    {/each}

    {#each blueLocations as locationTransformation}
        <g transform={locationTransformation}>
            <g transform={blueShapeTransformation}>
                <BlueShip />
            </g>
        </g>
    {/each}

    {#each grayLocations as locationTransformation}
        <g transform={locationTransformation}>
            <g transform={grayShapeTransformation}>
                <SilverShip />
            </g>
        </g>
    {/each}

    {#each greenLocations as locationTransformation}
        <g transform={locationTransformation}>
            <g transform={greenShapeTransformation}>
                <GreenShip />
            </g>
        </g>
    {/each}

    {#each purpleLocations as locationTransformation}
        <g transform={locationTransformation}>
            <g transform={purpleShapeTransformation}>
                <PurpleShip />
            </g>
        </g>
    {/each}

    {#each blackLocations as locationTransformation}
        <g transform={locationTransformation}>
            <g transform={blackShapeTransformation}>
                <BlackShip />
            </g>
        </g>
    {/each}
{/if}

<g>
    <rect onclick={onClick} x="0" y="0" width="1280" height="1280" fill="transparent"></rect>
    {#each tempDiversLocations as { id, point }}
        <Sundiver
            onclick={() => {
                diverClick(id)
            }}
            color="blue"
            quantity={1}
            location={point}
        />
        <g transform={translateFromCenter(point.x, point.y)}>
            <text
                y="-6"
                style="pointer-events: none"
                class="select-none"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="12"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >{point.x}
            </text>
            <text
                y="6"
                style="pointer-events: none"
                class="select-none"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="12"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >{point.y}
            </text>
        </g>
    {/each}

    {#each tempTowersLocations as { id, point }}
        <Tower
            onclick={() => {
                towerClick(id)
            }}
            color="blue"
            quantity={1}
            location={point}
        />
        <g transform={translateFromCenter(point.x, point.y)}>
            <text
                y="-6"
                style="pointer-events: none"
                class="select-none"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="12"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >{point.x}
            </text>
            <text
                y="6"
                style="pointer-events: none"
                class="select-none"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="12"
                font-weight="bold"
                stroke-width="1"
                stroke="#FFFFFF"
                fill="white"
                >{point.y}
            </text>
        </g>
    {/each}
</g>
<text
    x="150"
    y="50"
    onclick={() => {
        hideStuff = !hideStuff
    }}
    text-anchor="middle"
    font-size="40"
    font-weight="bold"
    opacity=".5"
    fill="white"
    >TOGGLE STUFF
</text>

<text
    x="150"
    y="100"
    onclick={chooseSundiver}
    text-anchor="middle"
    font-size="40"
    font-weight="bold"
    opacity=".5"
    fill="white"
    >SUNDIVERS
</text>

<text
    x="150"
    y="150"
    onclick={chooseTower}
    text-anchor="middle"
    font-size="40"
    font-weight="bold"
    opacity=".5"
    fill="white"
    >TOWERS
</text>
