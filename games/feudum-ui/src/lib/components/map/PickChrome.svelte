<script lang="ts">
    import { isBright, isPickable, type BoardChrome } from '$lib/model/boardChrome.js'
    import { chipOf, roleOf, type BoardTarget } from '$lib/model/boardOffer.js'
    import type { Point } from '$lib/utils/boardGeometry.js'
    import PickChip from './PickChip.svelte'

    /**
     * One target's pick chrome, in the layer that draws the target: the ring over its halo, its chip
     * and its press. What it shows is the board offer's and nothing else (contract: Pick conventions).
     * It stands whatever the role, so a popup always has its anchor. A layer that draws the chip over
     * what stands on the target leaves it out here.
     */
    let {
        target,
        chrome,
        at,
        width,
        height = width,
        round = true,
        label,
        drawsChip = true
    }: {
        target: BoardTarget
        chrome: BoardChrome
        at: Point
        width: number
        height?: number
        round?: boolean
        label: string
        drawsChip?: boolean
    } = $props()

    const Corner = 14
    const Halo = 5
    const Rings = { lit: 6, picked: 11, 'being-decided': 5 } as const

    let role = $derived(roleOf(chrome.offer, target))
    let chip = $derived(chipOf(chrome.offer, target))
    let bright = $derived(isBright(chrome, target))
    let corner = $derived(round ? Math.min(width, height) / 2 : Corner)
    let ring = $derived(
        role === 'lit' || role === 'picked' || role === 'being-decided' ? Rings[role] : undefined
    )
    let pickable = $derived(isPickable(role) && chrome.press !== undefined)

    function press() {
        chrome.press?.(target)
    }

    function onKey(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            press()
        }
    }
</script>

{#snippet outline(stroke: string, strokeWidth: number, dash?: string)}
    <rect
        x={-width / 2}
        y={-height / 2}
        {width}
        {height}
        rx={corner}
        fill="none"
        {stroke}
        stroke-width={strokeWidth}
        stroke-dasharray={dash}
    ></rect>
{/snippet}

<g
    transform="translate({at.x} {at.y})"
    data-pick={target}
    data-pick-role={role}
    data-bright={bright ? true : undefined}
>
    <rect x={-width / 2} y={-height / 2} {width} {height} rx={corner} fill="none" stroke="none"
    ></rect>
    {#if bright}
        {@render outline('var(--feudum-halo)', 16 + Halo)}
        {@render outline('var(--feudum-text)', 16)}
    {/if}
    {#if ring}
        {@render outline('var(--feudum-halo)', ring + Halo)}
        {#if role === 'being-decided'}
            {@render outline('var(--feudum-decided)', ring, '14 10')}
        {:else}
            {@render outline('var(--feudum-accent)', ring)}
        {/if}
    {/if}
    {#if pickable}
        <rect
            x={-width / 2}
            y={-height / 2}
            {width}
            {height}
            rx={corner}
            fill="transparent"
            role="button"
            tabindex="0"
            aria-label={label}
            aria-pressed={role === 'picked'}
            pointer-events="all"
            cursor="pointer"
            onclick={press}
            onkeydown={onKey}
        ></rect>
    {/if}
    {#if chip && drawsChip}
        <PickChip {chip} y={-height / 2 - 24} />
    {/if}
</g>
