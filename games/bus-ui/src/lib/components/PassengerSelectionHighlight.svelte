<script lang="ts">
    import type { BusNodeId } from '@tabletop/bus'
    import { BUS_BOARD_NODE_POINTS } from '$lib/definitions/busBoardGraph.js'
    import Passenger from './Passenger.svelte'

    let {
        nodeId,
        count,
        isSelected = false,
        onChoose
    }: {
        nodeId: BusNodeId
        count: number
        isSelected?: boolean
        onChoose?: (nodeId: BusNodeId) => void
    } = $props()

    const BASE_HEIGHT = 74
    const ACTIVE_HEIGHT = 77
    const HIT_RADIUS = 34
    const FOCUS_OUTLINE_RADIUS = 30

    const point = $derived(BUS_BOARD_NODE_POINTS[nodeId])
    let hovered = $state(false)
    let keyboardFocused = $state(false)

    const active = $derived(isSelected || hovered || keyboardFocused)
    const height = $derived(hovered && !isSelected ? ACTIVE_HEIGHT : BASE_HEIGHT)
    const stroke = $derived(isSelected ? '#ffffff' : '#f5ea6e')
    const strokeWidth = $derived(isSelected ? 6.8 : active ? 6.2 : 5.6)
    const outerStroke = $derived(isSelected ? '#333333' : '#2c4f63')
    const outerStrokeWidth = $derived(strokeWidth + 2.4)
    const fill = $derived(active ? '#f67816' : '#f46b0b')
    const focusOutlineOpacity = $derived(keyboardFocused ? 0.95 : 0)

    function chooseNode() {
        onChoose?.(nodeId)
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return
        }

        event.preventDefault()
        chooseNode()
    }

    function handleFocus(event: FocusEvent) {
        const target = event.currentTarget as SVGCircleElement | null
        keyboardFocused = target?.matches(':focus-visible') ?? false
    }

    function handleBlur() {
        keyboardFocused = false
    }
</script>

<g class="passenger-selection-highlight pointer-events-auto">
    <Passenger
        x={point.x}
        y={point.y}
        {count}
        {height}
        {fill}
        {stroke}
        {strokeWidth}
        {outerStroke}
        {outerStrokeWidth}
    />
    <circle
        cx={point.x}
        cy={point.y}
        r={FOCUS_OUTLINE_RADIUS}
        fill="none"
        stroke="#ffffff"
        stroke-width="2.5"
        opacity={focusOutlineOpacity}
        pointer-events="none"
        style="transition: opacity 120ms ease-out;"
    ></circle>
    <circle
        cx={point.x}
        cy={point.y}
        r={HIT_RADIUS}
        fill="transparent"
        class="cursor-pointer passenger-hit-target"
        role="button"
        tabindex="0"
        aria-pressed={isSelected}
        aria-label={`Choose passenger at node ${nodeId}`}
        onpointerdown={() => (keyboardFocused = false)}
        onmouseenter={() => (hovered = true)}
        onmouseleave={() => (hovered = false)}
        onfocus={handleFocus}
        onblur={handleBlur}
        onclick={chooseNode}
        onkeydown={handleKeyDown}
    ></circle>
</g>

<style>
    .passenger-hit-target:focus {
        outline: none;
    }
</style>
