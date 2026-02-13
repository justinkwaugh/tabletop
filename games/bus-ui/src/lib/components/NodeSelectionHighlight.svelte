<script lang="ts">
    import type { BusNodeId } from '@tabletop/bus'
    import { BUS_BOARD_NODE_POINTS } from '$lib/definitions/busBoardGraph.js'

    let {
        nodeId,
        isSelected = false,
        onChoose
    }: {
        nodeId: BusNodeId
        isSelected?: boolean
        onChoose?: (nodeId: BusNodeId) => void
    } = $props()

    const NODE_RING_RADIUS = 27
    const NODE_RING_STROKE_WIDTH = 8
    const NODE_OUTER_BORDER_WIDTH = 3
    const NODE_OUTER_BORDER_RADIUS =
        NODE_RING_RADIUS + NODE_RING_STROKE_WIDTH / 2 + NODE_OUTER_BORDER_WIDTH / 2
    const NODE_HIT_RADIUS = 40
    const NODE_HALO_RADIUS = NODE_RING_RADIUS + NODE_RING_STROKE_WIDTH / 2 + 6
    const NODE_FOCUS_OUTLINE_RADIUS = NODE_HIT_RADIUS + 2

    const point = $derived(BUS_BOARD_NODE_POINTS[nodeId])
    let hovered = $state(false)
    let keyboardFocused = $state(false)

    const active = $derived(isSelected || hovered || keyboardFocused)
    const outerStroke = $derived(active ? '#ffffff' : '#333')
    const outerStrokeWidth = $derived(
        active ? NODE_OUTER_BORDER_WIDTH + 0.75 : NODE_OUTER_BORDER_WIDTH
    )
    const ringStroke = $derived(active ? '#fff27a' : '#f5ea6e')
    const haloOpacity = $derived(active ? 0.28 : 0.14)
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

<g class="node-selection-highlight pointer-events-auto">
    <circle
        cx={point.x}
        cy={point.y}
        r={NODE_HALO_RADIUS}
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
        r={NODE_OUTER_BORDER_RADIUS}
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
        r={NODE_RING_RADIUS}
        fill="none"
        stroke={ringStroke}
        stroke-width={NODE_RING_STROKE_WIDTH}
        pointer-events="none"
        style="transition: stroke 140ms ease-out;"
    ></circle>
    <circle
        cx={point.x}
        cy={point.y}
        r={NODE_FOCUS_OUTLINE_RADIUS}
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
        r={NODE_HIT_RADIUS}
        fill="transparent"
        class="cursor-pointer node-hit-target"
        role="button"
        tabindex="0"
        aria-pressed={isSelected}
        aria-label={`Choose node ${nodeId}`}
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
    .node-hit-target:focus {
        outline: none;
    }
</style>
