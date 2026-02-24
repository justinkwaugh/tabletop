<script lang="ts">
    import GlassBeadMarker from '$lib/components/GlassBeadMarker.svelte'
    import { boardAreaPathById } from '$lib/definitions/boardGeometry.js'
    import { LAND_MARKER_POSITIONS } from '$lib/definitions/landMarkerPositions.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { getPathCenter } from '$lib/utils/geometry.js'

    type BeadTone = 'amber' | 'green' | 'red'

    type CityMarker = {
        key: string
        x: number
        y: number
        tone: BeadTone
    }

    const gameSession = getGameSession()
    const CITY_MARKER_HEIGHT = 54

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
            const markerPosition = LAND_MARKER_POSITIONS[city.area]
            if (markerPosition) {
                markers.push({
                    key: city.id,
                    x: markerPosition.x,
                    y: markerPosition.y,
                    tone: beadToneForCitySize(city.size)
                })
                continue
            }

            const areaPath = boardAreaPathById(city.area)
            if (!areaPath) {
                continue
            }

            const center = getPathCenter(areaPath)
            markers.push({
                key: city.id,
                x: center.x,
                y: center.y,
                tone: beadToneForCitySize(city.size)
            })
        }

        return markers
    })
</script>

<g class="pointer-events-none select-none" aria-label="Cities layer">
    {#each cityMarkers as marker (marker.key)}
        <GlassBeadMarker x={marker.x} y={marker.y} tone={marker.tone} height={CITY_MARKER_HEIGHT} />
    {/each}
</g>
