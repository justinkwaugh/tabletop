<script lang="ts">
    import { SQUARE_SIZE, squareOrigin } from '$lib/board/geometry.js'
    import { createDistrictTooltip } from '$lib/board/districtTooltip.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'

    let {
        pos,
        hasBuilding,
        hasArchitect,
        clickable,
        onHover,
        onHoverEnd,
        onclick
    }: {
        pos: number
        hasBuilding: boolean
        hasArchitect: boolean
        clickable: boolean
        onHover: (pos: number) => void
        onHoverEnd: () => void
        onclick: () => void
    } = $props()

    const session = getGameSession()
    const origin = $derived(squareOrigin(pos))

    let hovered = $state(false)
    let tooltipEl: HTMLDivElement | null = null

    function onmouseenter() {
        hovered = true
        onHover(pos)
        if (!hasBuilding) return
        tooltipEl = createDistrictTooltip(session, pos)
        document.body.appendChild(tooltipEl)
    }

    function onmouseleave() {
        hovered = false
        onHoverEnd()
        tooltipEl?.remove()
        tooltipEl = null
    }

    $effect(() => () => {
        tooltipEl?.remove()
        tooltipEl = null
    })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<rect
    data-board-pos={pos}
    x={origin.x}
    y={origin.y}
    width={SQUARE_SIZE}
    height={SQUARE_SIZE}
    fill="transparent"
    stroke={clickable && hovered && !hasArchitect ? '#f2c14e' : 'none'}
    stroke-width="3"
    class={clickable ? 'cursor-pointer' : 'cursor-default'}
    {onclick}
    {onmouseenter}
    {onmouseleave}
/>
{#if clickable && hovered && hasArchitect}
    <circle
        cx={origin.x + SQUARE_SIZE / 2}
        cy={origin.y + SQUARE_SIZE / 2}
        r={0.45 * SQUARE_SIZE}
        fill="none"
        stroke="#f2c14e"
        stroke-width="3"
        pointer-events="none"
    />
{/if}
