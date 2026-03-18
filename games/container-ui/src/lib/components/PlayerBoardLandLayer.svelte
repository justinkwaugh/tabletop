<script lang="ts">
    import type { PlayerBoardSeat } from '$lib/definitions/boardLayout.js'

    const LAND_FILL = '#c6cba4'
    const SHORE_DARK = '#746253'
    const SHORE_LIGHT = '#ebe5c8'

    const LAND_OUTER_PAD = 86
    const LAND_TOP_PAD = 44
    const LAND_BOTTOM_PAD = 80
    const DOCK_TOP_Y_RATIO = 0.12
    const DOCK_BOTTOM_Y_RATIO = 0.79
    const DOCK_NOTCH_RATIO = 0.75
    const TOP_WRAP = 18
    const BOTTOM_WRAP = 44
    const CONNECTOR_OUT_RATIO = 0.38
    const CONNECTOR_IN_RATIO = 0.74

    let { playerBoardSeats }: { playerBoardSeats: PlayerBoardSeat[] } = $props()

    type LandGeometry = {
        key: string
        patchPath: string
        shorePath: string
    }

    function buildConnector(
        side: 'left' | 'right',
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        outwardX: number
    ) {
        const dir = side === 'left' ? 1 : -1
        const midOutY = startY + (endY - startY) * CONNECTOR_OUT_RATIO
        const midInY = startY + (endY - startY) * CONNECTOR_IN_RATIO
        const endControlX = endX + dir * 10
        const endControlY = endY - 4

        return [
            `C ${startX + dir * 18} ${startY + 10} ${outwardX} ${midOutY - 18} ${outwardX} ${midOutY}`,
            `C ${outwardX} ${midOutY + 18} ${outwardX - dir * 4} ${midInY - 18} ${outwardX - dir * 6} ${midInY}`,
            `C ${outwardX - dir * 10} ${midInY + 18} ${endControlX} ${endControlY} ${endX} ${endY}`
        ].join(' ')
    }

    function buildLandGeometry(
        seat: PlayerBoardSeat,
        nextSeat: PlayerBoardSeat | undefined
    ): LandGeometry {
        const left = seat.x
        const top = seat.y
        const right = seat.x + seat.width
        const bottom = seat.y + seat.height
        const patchTop = top - LAND_TOP_PAD
        const patchBottom = bottom + LAND_BOTTOM_PAD
        const dockTopY = top + seat.height * DOCK_TOP_Y_RATIO
        const dockBottomY = top + seat.height * DOCK_BOTTOM_Y_RATIO

        if (seat.orientation === 'left') {
            const outerLeft = left - LAND_OUTER_PAD
            const topWrapX = right + TOP_WRAP
            const bottomWrapX = right + BOTTOM_WRAP
            const notchX = left + seat.width * DOCK_NOTCH_RATIO
            const upperNotchY = dockTopY + 24
            const lowerNotchY = dockBottomY - 26
            const nextPatchTop = nextSeat ? nextSeat.y - LAND_TOP_PAD : patchBottom
            const nextTopWrapX = nextSeat ? nextSeat.x + nextSeat.width + TOP_WRAP : bottomWrapX
            const connectorPath = nextSeat
                ? buildConnector('left', right + 8, bottom - 34, nextTopWrapX, nextPatchTop, right + 42)
                : `C ${right + 14} ${bottom - 16} ${bottomWrapX} ${bottom - 6} ${nextTopWrapX} ${nextPatchTop}`
            const patchPath = [
                `M ${outerLeft} ${patchTop}`,
                `L ${topWrapX} ${patchTop}`,
                `C ${right + 10} ${patchTop + 2} ${right + 8} ${top + 12} ${right + 3} ${dockTopY + 8}`,
                `C ${right + 1} ${dockTopY + 16} ${notchX + 8} ${dockTopY + 18} ${notchX} ${upperNotchY}`,
                `L ${notchX} ${lowerNotchY}`,
                `C ${notchX + 4} ${dockBottomY - 2} ${right + 6} ${dockBottomY + 10} ${right + 8} ${bottom - 34}`,
                connectorPath,
                `L ${outerLeft} ${nextPatchTop}`,
                'Z'
            ].join(' ')

            const shorePath = [
                `M ${topWrapX} ${patchTop}`,
                `C ${right + 10} ${patchTop + 2} ${right + 8} ${top + 12} ${right + 3} ${dockTopY + 8}`,
                `C ${right + 1} ${dockTopY + 16} ${notchX + 8} ${dockTopY + 18} ${notchX} ${upperNotchY}`,
                `L ${notchX} ${lowerNotchY}`,
                `C ${notchX + 4} ${dockBottomY - 2} ${right + 6} ${dockBottomY + 10} ${right + 8} ${bottom - 34}`,
                connectorPath
            ].join(' ')

            return {
                key: seat.playerId,
                patchPath,
                shorePath
            }
        }

        const outerRight = right + LAND_OUTER_PAD
        const topWrapX = left - TOP_WRAP
        const bottomWrapX = left - BOTTOM_WRAP
        const notchX = right - seat.width * DOCK_NOTCH_RATIO
        const upperNotchY = dockTopY + 24
        const lowerNotchY = dockBottomY - 26
        const nextPatchTop = nextSeat ? nextSeat.y - LAND_TOP_PAD : patchBottom
        const nextTopWrapX = nextSeat ? nextSeat.x - TOP_WRAP : bottomWrapX
        const connectorPath = nextSeat
            ? buildConnector('right', left - 8, bottom - 34, nextTopWrapX, nextPatchTop, left - 42)
            : `C ${left - 14} ${bottom - 16} ${bottomWrapX} ${bottom - 6} ${nextTopWrapX} ${nextPatchTop}`
        const patchPath = [
            `M ${outerRight} ${patchTop}`,
            `L ${topWrapX} ${patchTop}`,
            `C ${left - 10} ${patchTop + 2} ${left - 8} ${top + 12} ${left - 3} ${dockTopY + 8}`,
            `C ${left - 1} ${dockTopY + 16} ${notchX - 8} ${dockTopY + 18} ${notchX} ${upperNotchY}`,
            `L ${notchX} ${lowerNotchY}`,
            `C ${notchX - 4} ${dockBottomY - 2} ${left - 6} ${dockBottomY + 10} ${left - 8} ${bottom - 34}`,
            connectorPath,
            `L ${outerRight} ${nextPatchTop}`,
            'Z'
        ].join(' ')

        const shorePath = [
            `M ${topWrapX} ${patchTop}`,
            `C ${left - 10} ${patchTop + 2} ${left - 8} ${top + 12} ${left - 3} ${dockTopY + 8}`,
            `C ${left - 1} ${dockTopY + 16} ${notchX - 8} ${dockTopY + 18} ${notchX} ${upperNotchY}`,
            `L ${notchX} ${lowerNotchY}`,
            `C ${notchX - 4} ${dockBottomY - 2} ${left - 6} ${dockBottomY + 10} ${left - 8} ${bottom - 34}`,
            connectorPath
        ].join(' ')

        return {
            key: seat.playerId,
            patchPath,
            shorePath
        }
    }

    const landGeometries = $derived.by(() => {
        const leftSeats = playerBoardSeats
            .filter((seat) => seat.orientation === 'left')
            .sort((a, b) => a.y - b.y)
        const rightSeats = playerBoardSeats
            .filter((seat) => seat.orientation === 'right')
            .sort((a, b) => a.y - b.y)

        return [
            ...leftSeats.map((seat, index) => buildLandGeometry(seat, leftSeats[index + 1])),
            ...rightSeats.map((seat, index) => buildLandGeometry(seat, rightSeats[index + 1]))
        ]
    })
</script>

<defs>
    <filter id="container-player-land-shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#2f334f" flood-opacity="0.16"></feDropShadow>
    </filter>
</defs>

<g aria-hidden="true">
    {#each landGeometries as geometry (geometry.key)}
        <path d={geometry.patchPath} fill={LAND_FILL} filter="url(#container-player-land-shadow)"></path>
    {/each}

    {#each landGeometries as geometry (geometry.key)}
        <path
            d={geometry.shorePath}
            fill="none"
            stroke={SHORE_DARK}
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.55"
        ></path>
        <path
            d={geometry.shorePath}
            fill="none"
            stroke={SHORE_LIGHT}
            stroke-width="1.15"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.74"
        ></path>
    {/each}
</g>
