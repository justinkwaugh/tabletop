<script lang="ts">
    import type { BuildingSiteId } from '@tabletop/bus'
    import { BUS_BUILDING_SITE_POINTS } from '$lib/definitions/busBoardGraph.js'

    let {
        siteId,
        isSelected = false,
        onChoose
    }: {
        siteId: BuildingSiteId
        isSelected?: boolean
        onChoose?: (siteId: BuildingSiteId) => void
    } = $props()

    const BUILDING_SITE_CIRCLE_RADIUS = 24
    const BUILDING_SITE_HIGHLIGHT_STROKE_WIDTH = 0
    const BUILDING_SITE_HIGHLIGHT_RING_RADIUS =
        BUILDING_SITE_CIRCLE_RADIUS + BUILDING_SITE_HIGHLIGHT_STROKE_WIDTH / 2
    const BUILDING_SITE_HIGHLIGHT_OUTER_BORDER_WIDTH = 3
    const BUILDING_SITE_HIGHLIGHT_OUTER_BORDER_RADIUS =
        BUILDING_SITE_HIGHLIGHT_RING_RADIUS +
        BUILDING_SITE_HIGHLIGHT_STROKE_WIDTH / 2 +
        BUILDING_SITE_HIGHLIGHT_OUTER_BORDER_WIDTH / 2
    const BUILDING_SITE_HIGHLIGHT_HIT_RADIUS = 35
    const BUILDING_SITE_HIGHLIGHT_HALO_RADIUS = BUILDING_SITE_HIGHLIGHT_RING_RADIUS + 7
    const BUILDING_SITE_FOCUS_OUTLINE_RADIUS = BUILDING_SITE_HIGHLIGHT_HIT_RADIUS + 2

    const point = $derived(BUS_BUILDING_SITE_POINTS[siteId])
    let hovered = $state(false)
    let keyboardFocused = $state(false)

    const active = $derived(isSelected || hovered || keyboardFocused)
    const outerStroke = $derived(active ? '#ffffff' : '#333')
    const outerStrokeWidth = $derived(active ? BUILDING_SITE_HIGHLIGHT_OUTER_BORDER_WIDTH + 0.75 : 3)
    const fillStroke = $derived(active ? '#fff27a' : '#f5ea6e')
    const haloOpacity = $derived(active ? 0.28 : 0)
    const focusOutlineOpacity = $derived(keyboardFocused ? 0.95 : 0)

    function chooseSite() {
        onChoose?.(siteId)
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return
        }

        event.preventDefault()
        chooseSite()
    }

    function handleFocus(event: FocusEvent) {
        const target = event.currentTarget as SVGCircleElement | null
        keyboardFocused = target?.matches(':focus-visible') ?? false
    }

    function handleBlur() {
        keyboardFocused = false
    }
</script>

<g class="building-site-highlight pointer-events-auto">
    <circle
        cx={point.x}
        cy={point.y}
        r={BUILDING_SITE_HIGHLIGHT_HALO_RADIUS}
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
        r={BUILDING_SITE_HIGHLIGHT_OUTER_BORDER_RADIUS}
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
        r={BUILDING_SITE_HIGHLIGHT_RING_RADIUS}
        fill={fillStroke}
        stroke={fillStroke}
        stroke-width={BUILDING_SITE_HIGHLIGHT_STROKE_WIDTH}
        opacity="1"
        pointer-events="none"
        style="transition: fill 140ms ease-out, stroke 140ms ease-out;"
    ></circle>
    <circle
        cx={point.x}
        cy={point.y}
        r={BUILDING_SITE_FOCUS_OUTLINE_RADIUS}
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
        r={BUILDING_SITE_HIGHLIGHT_HIT_RADIUS}
        fill="transparent"
        class="cursor-pointer site-hit-target"
        role="button"
        tabindex="0"
        aria-pressed={isSelected}
        aria-label={`Choose building site ${siteId}`}
        onpointerdown={() => (keyboardFocused = false)}
        onmouseenter={() => (hovered = true)}
        onmouseleave={() => (hovered = false)}
        onfocus={handleFocus}
        onblur={handleBlur}
        onclick={chooseSite}
        onkeydown={handleKeyDown}
    ></circle>
</g>

<style>
    .site-hit-target:focus {
        outline: none;
    }
</style>
