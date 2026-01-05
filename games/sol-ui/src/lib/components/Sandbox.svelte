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
    import UISundiver from './Sundiver.svelte'
    import Gate from './BoardGate.svelte'
    // import Tower from './Tower.svelte'
    import BlueShip from '$lib/images/blueShip.svelte'
    import SilverShip from '$lib/images/silverShip.svelte'
    import {
        Direction,
        HydratedSolGameBoard,
        Ring,
        SolGraph,
        StationType,
        Sundiver,
        Station
    } from '@tabletop/sol'
    import { Color, type Point } from '@tabletop/common'
    import { nanoid } from 'nanoid'
    import GreenShip from '$lib/images/greenShip.svelte'
    import PurpleShip from '$lib/images/purpleShip.svelte'
    import BlackShip from '$lib/images/blackShip.svelte'
    import { CELL_LAYOUT_5P } from '$lib/utils/cellLayout5p.js'
    import { CELL_LAYOUT_4P } from '$lib/utils/cellLayout4p.js'
    import { getCellLayout } from '$lib/utils/cellLayouts.js'
    import Energynode from '$lib/images/energynode.svelte'
    import UIStation from './Station.svelte'

    enum PieceType {
        Sundiver,
        Tower
    }

    const colorPerPlayerId: { [playerId: string]: Color } = {
        p0: Color.Blue,
        p1: Color.Gray,
        p2: Color.Green,
        p3: Color.Purple,
        p4: Color.Black
    }

    let numPlayers = 4

    let numDiversPerCell = $state(0)
    let gates = $state(false)
    let station: StationType | undefined = $state(undefined)
    let ships = $state(false)

    let sandboxBoard = $derived.by(() => {
        const board = new HydratedSolGameBoard({
            numPlayers,
            motherships: {},
            cells: {},
            gates: {}
        })

        for (const cell of board) {
            const sundivers: Sundiver[] = []
            for (let i = 0; i < numDiversPerCell; i++) {
                sundivers.push({
                    id: nanoid(),
                    playerId: 'p' + i,
                    reserve: false
                })
            }
            board.addSundiversToCell(sundivers, cell.coords)
        }

        if (gates) {
            for (const node of board) {
                if (
                    node.coords.row === Ring.Inner ||
                    node.coords.row === Ring.Convective ||
                    node.coords.row === Ring.Radiative
                ) {
                    for (const neighbor of board.neighborsAt(node.coords, Direction.In)) {
                        board.addGateAt(
                            { id: nanoid(), playerId: 'p1' },
                            neighbor.coords,
                            node.coords
                        )
                    }
                }
            }
        }

        if (station) {
            const newStation = {
                id: nanoid(),
                playerId: 'p1',
                type: station
            }
            for (const cell of board) {
                board.addStationAt(newStation, cell.coords)
            }
        }
        return board
    })

    // console.log(getCirclePoint(148, toRadians(45)))

    let hideStuff: boolean = $state(true)
    let currentType: PieceType = $state(PieceType.Sundiver)

    // const gatePositions: GatePosition[] = []
    const graph = new SolGraph(numPlayers)
    // for (const node of graph) {
    //     if (
    //         node.coords.row === Ring.Inner ||
    //         node.coords.row === Ring.Convective ||
    //         node.coords.row === Ring.Radiative
    //     ) {
    //         for (const neighbor of graph.neighborsOf(node, Direction.In)) {
    //             gatePositions.push(getGatePosition(numPlayers, neighbor.coords, node.coords))
    //         }
    //     }
    // }

    const spaceLabels: { point: Point; label: string }[] = []
    for (const node of graph) {
        spaceLabels.push({
            point: getSpaceCentroid(numPlayers, node.coords),
            label: `[${node.coords.row}, ${node.coords.col}]`
        })
    }

    type DiverInfo = {
        playerId: string
        point: Point
    }

    const divers = $derived.by(() => {
        const diverInfos: DiverInfo[] = []
        for (const cell of sandboxBoard) {
            const cellLayout = getCellLayout(cell, numPlayers, sandboxBoard)
            for (let i = 0; i < cell.sundivers.length; i++) {
                const diver = cell.sundivers[i]
                const diverPoint = cellLayout.divers[i]
                diverInfos.push({
                    playerId: diver.playerId,
                    point: diverPoint
                })
            }
        }
        return diverInfos
    })

    const gatePositions = $derived.by(() => {
        return Object.values(sandboxBoard.gates).map((gate) => {
            return getGatePosition(numPlayers, gate.innerCoords!, gate.outerCoords!)
        })
    })

    type StationInfo = {
        point: Point
        station: Station
    }
    const stations = $derived.by(() => {
        const stationPoints: StationInfo[] = []
        for (const cell of sandboxBoard) {
            if (cell.station) {
                const cellLayout = getCellLayout(cell, numPlayers, sandboxBoard)
                if (cellLayout.station) {
                    stationPoints.push({ point: cellLayout.station.point, station: cell.station })
                }
            }
        }
        return stationPoints
    })

    const diverLocs: { point: Point; quantity: number }[] = []
    for (const node of graph) {
        const layoutKey = `${node.coords.row}-${node.coords.col}`
        const cellLayouts = CELL_LAYOUT_4P[layoutKey] ?? {}
        const layout = cellLayouts['t-g1-g2'] ?? cellLayouts['t-g1'] ?? cellLayouts['t']
        if (layout) {
            diverLocs.push(
                ...layout.divers.map((diver: Point, index: number) => {
                    return { point: diver, quantity: index + 1 }
                })
            )
        }
    }

    const towerLocs: Point[] = []
    for (const node of graph) {
        const layoutKey = `${node.coords.row}-${node.coords.col}`
        const cellLayouts = CELL_LAYOUT_4P[layoutKey] ?? {}
        const layout = cellLayouts['t-g1-g2'] ?? cellLayouts['t-g1'] ?? cellLayouts['t']
        if (layout && layout.station) {
            towerLocs.push(layout.station.point)
        }
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

    function onClick(event: MouseEvent) {
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

<!-- {#each diverLocs as { point, quantity }}
    <Sundiver color="blue" {quantity} location={point} />
{/each} -->

<!-- {#each towerLocs as point}
    <Tower color="blue" location={point} />
{/each} -->

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
{/if}

{#if ships}
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
    {#each divers as { playerId, point }}
        <UISundiver color={colorPerPlayerId[playerId]} quantity={1} location={point} />
    {/each}
    {#each gatePositions as gatePosition}
        <Gate color="blue" position={gatePosition} />
    {/each}
    {#each stations as stationInfo}
        <g transform={translateFromCenter(stationInfo.point.x, stationInfo.point.y)}>
            <UIStation
                station={stationInfo.station}
                width={stationInfo.station.type !== StationType.TransmitTower ? 46 : 48}
                height={stationInfo.station.type !== StationType.TransmitTower ? 48 : 100}
                color="blue"
            />
        </g>
    {/each}
    <rect onclick={onClick} x="0" y="0" width="1280" height="1280" fill="transparent"></rect>

    {#each tempDiversLocations as { id, point }}
        <UISundiver
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
        <!-- <Tower
            onclick={() => {
                towerClick(id)
            }}
            color="blue"
            location={point}
        /> -->
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

<!-- <text
    x="150"
    y="100"
    onclick={chooseSundiver}
    text-anchor="middle"
    font-size="40"
    font-weight="bold"
    opacity=".5"
    fill="white"
    >SUNDIVERS
</text> -->

<!-- <text
    x="150"
    y="150"
    onclick={chooseTower}
    text-anchor="middle"
    font-size="40"
    font-weight="bold"
    opacity=".5"
    fill="white"
    >TOWERS
</text> -->

<text x="0" y="100" text-anchor="start" font-size="30" font-weight="bold" opacity="1" fill="white"
    >SHIPS
</text>

<text
    onclick={() => {
        ships = true
    }}
    x={120}
    y="100"
    text-anchor="start"
    font-size="30"
    font-weight="bold"
    opacity="1"
    fill="white"
    >ON
</text>
<text
    onclick={() => {
        ships = false
    }}
    x={180}
    y="100"
    text-anchor="start"
    font-size="30"
    font-weight="bold"
    opacity="1"
    fill="white"
    >OFF
</text>

<text x="0" y="150" text-anchor="start" font-size="30" font-weight="bold" opacity="1" fill="white"
    >STATION
</text>

<text
    onclick={() => {
        station = undefined
    }}
    x="140"
    y="150"
    text-anchor="start"
    font-size="30"
    font-weight="bold"
    opacity="1"
    fill="white"
    >N
</text>
<text
    onclick={() => {
        station = StationType.EnergyNode
    }}
    x="170"
    y="150"
    text-anchor="start"
    font-size="30"
    font-weight="bold"
    opacity="1"
    fill="white"
    >E
</text>
<text
    onclick={() => {
        station = StationType.SundiverFoundry
    }}
    x="200"
    y="150"
    text-anchor="start"
    font-size="30"
    font-weight="bold"
    opacity="1"
    fill="white"
    >F
</text>
<text
    onclick={() => {
        station = StationType.TransmitTower
    }}
    x="230"
    y="150"
    text-anchor="start"
    font-size="30"
    font-weight="bold"
    opacity="1"
    fill="white"
    >T
</text>

<text x="0" y="200" text-anchor="start" font-size="30" font-weight="bold" opacity="1" fill="white"
    >NUM D
</text>
{#each { length: numPlayers + 1 }, index}
    <text
        onclick={() => {
            numDiversPerCell = index
        }}
        x={110 + index * 30}
        y="200"
        text-anchor="start"
        font-size="30"
        font-weight="bold"
        opacity="1"
        fill="white"
        >{index}
    </text>
{/each}

<text x="0" y="250" text-anchor="start" font-size="30" font-weight="bold" opacity="1" fill="white"
    >GATES
</text>

<text
    onclick={() => {
        gates = true
    }}
    x={120}
    y="250"
    text-anchor="start"
    font-size="30"
    font-weight="bold"
    opacity="1"
    fill="white"
    >ON
</text>
<text
    onclick={() => {
        gates = false
    }}
    x={180}
    y="250"
    text-anchor="start"
    font-size="30"
    font-weight="bold"
    opacity="1"
    fill="white"
    >OFF
</text>
