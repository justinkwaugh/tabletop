<script lang="ts">
    import { CITY_DEMAND_MARKER_POSITIONS_BY_REGION } from '$lib/definitions/cityDemandMarkerPositions.js'
    import CityDemandMarker from '$lib/components/CityDemandMarker.svelte'
    import GlassBeadMarker from '$lib/components/GlassBeadMarker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { resolveLandMarkerPosition } from '$lib/utils/boardMarkers.js'
    import { Good, MachineState } from '@tabletop/indonesia'

    type BeadTone = 'amber' | 'green' | 'red'

    type CityMarker = {
        key: string
        x: number
        y: number
        tone: BeadTone
    }

    type CityDemandTag = {
        key: string
        x: number
        y: number
        targetX: number
        targetY: number
        demands: Array<{
            good: Good
            count: number
        }>
    }

    const gameSession = getGameSession()
    const CITY_MARKER_HEIGHT = 54
    const BOARD_WIDTH = 2646
    const BOARD_HEIGHT = 1280
    const BOARD_CENTER = { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 }
    const DEMAND_TAG_DISTANCE = 62
    const DEMAND_TAG_MAX_OFFSET = 14

    const DEMAND_GOOD_ORDER = [
        Good.Rice,
        Good.Spice,
        Good.Rubber,
        Good.SiapSaji,
        Good.Oil
    ] as const
    const OPERATIONS_MACHINE_STATES = new Set<MachineState>([
        MachineState.Operations,
        MachineState.ShippingOperations,
        MachineState.ProductionOperations
    ])

    function beadToneForCitySize(size: number): BeadTone {
        if (size === 1) {
            return 'amber'
        }
        if (size === 2) {
            return 'green'
        }
        return 'red'
    }

    const cityMarkers: CityMarker[] = $derived.by(() => {
        const markers: CityMarker[] = []

        for (const city of gameSession.gameState.board.cities) {
            const markerPosition = resolveLandMarkerPosition(city.area)
            if (!markerPosition) {
                continue
            }

            markers.push({
                key: city.id,
                x: markerPosition.x,
                y: markerPosition.y,
                tone: beadToneForCitySize(city.size)
            })
        }

        return markers
    })

    const areaRegionById: Map<string, string> = $derived.by(() => {
        const byId = new Map<string, string>()
        for (const node of gameSession.gameState.board) {
            if (!node.region) {
                continue
            }
            byId.set(node.id, node.region)
        }
        return byId
    })

    function cityOffsetSeed(cityId: string): number {
        let hash = 0
        for (const char of cityId) {
            hash = (hash * 31 + char.charCodeAt(0)) >>> 0
        }
        return hash
    }

    function fallbackDemandTagPosition(markerPosition: { x: number; y: number }, cityId: string): {
        x: number
        y: number
    } {
        const dx = markerPosition.x - BOARD_CENTER.x
        const dy = markerPosition.y - BOARD_CENTER.y
        const magnitude = Math.hypot(dx, dy)
        const ux = magnitude > 0.001 ? dx / magnitude : 0
        const uy = magnitude > 0.001 ? dy / magnitude : -1
        const tx = -uy
        const ty = ux
        const jitter = ((cityOffsetSeed(cityId) % 5) - 2) * (DEMAND_TAG_MAX_OFFSET / 2)

        return {
            x: markerPosition.x + ux * DEMAND_TAG_DISTANCE + tx * jitter,
            y: markerPosition.y + uy * DEMAND_TAG_DISTANCE + ty * jitter
        }
    }

    const cityDemandTags: CityDemandTag[] = $derived.by(() => {
        if (!OPERATIONS_MACHINE_STATES.has(gameSession.gameState.machineState)) {
            return []
        }

        const tags: CityDemandTag[] = []

        for (const city of gameSession.gameState.board.cities) {
            const markerPosition = resolveLandMarkerPosition(city.area)
            if (!markerPosition) {
                continue
            }

            const demands = DEMAND_GOOD_ORDER.map((good) => ({
                good,
                count: gameSession.gameState.remainingCityDemandForGood(city, good)
            })).filter((entry) => entry.count > 0)

            if (demands.length === 0) {
                continue
            }

            const regionId = areaRegionById.get(city.area)
            const regionPosition = regionId
                ? CITY_DEMAND_MARKER_POSITIONS_BY_REGION[regionId]
                : undefined
            const fallbackPosition = fallbackDemandTagPosition(markerPosition, city.id)
            const x = regionPosition?.x ?? fallbackPosition.x
            const y = regionPosition?.y ?? fallbackPosition.y

            tags.push({
                key: city.id,
                x,
                y,
                targetX: markerPosition.x,
                targetY: markerPosition.y,
                demands
            })
        }

        return tags
    })
</script>

<g class="pointer-events-none select-none" aria-label="Cities layer">
    {#each cityMarkers as marker (marker.key)}
        <GlassBeadMarker x={marker.x} y={marker.y} tone={marker.tone} height={CITY_MARKER_HEIGHT} />
    {/each}

    {#each cityDemandTags as tag (tag.key)}
        <CityDemandMarker
            x={tag.x}
            y={tag.y}
            targetX={tag.targetX}
            targetY={tag.targetY}
            demands={tag.demands}
        />
    {/each}
</g>
