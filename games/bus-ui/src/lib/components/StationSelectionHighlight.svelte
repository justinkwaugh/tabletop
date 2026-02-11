<script lang="ts">
    import type { BusStationId } from '@tabletop/bus'
    import { BUS_BOARD_NODE_POINTS } from '$lib/definitions/busBoardGraph.js'

    let {
        stationId,
        isSelected = false,
        onChoose
    }: {
        stationId: BusStationId
        isSelected?: boolean
        onChoose?: (stationId: BusStationId) => void
    } = $props()

    const STATION_RING_RADIUS = 33
    const STATION_RING_STROKE_WIDTH = 8
    const STATION_OUTER_BORDER_WIDTH = 3
    const STATION_OUTER_BORDER_RADIUS =
        STATION_RING_RADIUS + STATION_RING_STROKE_WIDTH / 2 + STATION_OUTER_BORDER_WIDTH / 2
    const STATION_HIT_RADIUS = 46
    const STATION_HALO_RADIUS = STATION_RING_RADIUS + STATION_RING_STROKE_WIDTH / 2 + 6
    const STATION_FOCUS_OUTLINE_RADIUS = STATION_HIT_RADIUS + 2

    const point = $derived(BUS_BOARD_NODE_POINTS[stationId])
    let hovered = $state(false)
    let keyboardFocused = $state(false)

    const active = $derived(isSelected || hovered || keyboardFocused)
    const outerStroke = $derived(active ? '#ffffff' : '#333')
    const outerStrokeWidth = $derived(active ? STATION_OUTER_BORDER_WIDTH + 0.75 : STATION_OUTER_BORDER_WIDTH)
    const ringStroke = $derived(active ? '#fff27a' : '#f5ea6e')
    const haloOpacity = $derived(active ? 0.28 : 0.14)
    const focusOutlineOpacity = $derived(keyboardFocused ? 0.95 : 0)

    function chooseStation() {
        onChoose?.(stationId)
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return
        }

        event.preventDefault()
        chooseStation()
    }

    function handleFocus(event: FocusEvent) {
        const target = event.currentTarget as SVGCircleElement | null
        keyboardFocused = target?.matches(':focus-visible') ?? false
    }

    function handleBlur() {
        keyboardFocused = false
    }
</script>

<g class="station-selection-highlight pointer-events-auto">
    <circle
        cx={point.x}
        cy={point.y}
        r={STATION_HALO_RADIUS}
        fill="none"
        stroke="#facc15"
        stroke-width="6"
        opacity={haloOpacity}
        pointer-events="none"
        style="transition: opacity 140ms ease-out;"
    ></circle>
    <circle
        cx={point.x}
        cy={point.y}
        r={STATION_OUTER_BORDER_RADIUS}
        fill="none"
        stroke={outerStroke}
        stroke-width={outerStrokeWidth}
        opacity="0.95"
        pointer-events="none"
        style="transition: stroke 140ms ease-out, stroke-width 140ms ease-out;"
    ></circle>
    <circle
        cx={point.x}
        cy={point.y}
        r={STATION_RING_RADIUS}
        fill="none"
        stroke={ringStroke}
        stroke-width={STATION_RING_STROKE_WIDTH}
        pointer-events="none"
        style="transition: stroke 140ms ease-out;"
    ></circle>
    <circle
        cx={point.x}
        cy={point.y}
        r={STATION_FOCUS_OUTLINE_RADIUS}
        fill="none"
        stroke="#ffffff"
        stroke-width="2.5"
        opacity={focusOutlineOpacity}
        pointer-events="none"
        style="transition: opacity 110ms ease-out;"
    ></circle>
    <circle
        cx={point.x}
        cy={point.y}
        r={STATION_HIT_RADIUS}
        fill="transparent"
        class="cursor-pointer station-hit-target"
        role="button"
        tabindex="0"
        aria-pressed={isSelected}
        aria-label={`Choose station ${stationId}`}
        onpointerdown={() => (keyboardFocused = false)}
        onmouseenter={() => (hovered = true)}
        onmouseleave={() => (hovered = false)}
        onfocus={handleFocus}
        onblur={handleBlur}
        onclick={chooseStation}
        onkeydown={handleKeyDown}
    ></circle>
</g>

<style>
    .station-hit-target:focus {
        outline: none;
    }
</style>
