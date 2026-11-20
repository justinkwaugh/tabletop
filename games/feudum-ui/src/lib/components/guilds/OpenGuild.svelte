<script lang="ts">
    import type { Color } from '@tabletop/common'
    import type { GuildId, HydratedFeudumGameState } from '@tabletop/feudum'
    import BoardMotionLayer from '$lib/components/map/BoardMotionLayer.svelte'
    import PickChip from '$lib/components/map/PickChip.svelte'
    import type { BoardChrome } from '$lib/model/boardChrome.js'
    import { chipOf, guildTarget } from '$lib/model/boardOffer.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        GuildAreaHeight,
        GuildAreaWidth,
        GuildAreas,
        GuildBox,
        guildAreaAt
    } from '$lib/utils/boardGeometry.js'
    import BoardGuildArea from './BoardGuildArea.svelte'
    import UprightArea from './UprightArea.svelte'

    /** Contract, Desk layout: one guild area behind a desk's side button, stood upright. */
    let {
        guild,
        long,
        state,
        paintOf,
        colourPaintOf,
        chrome
    }: {
        guild: GuildId
        long: number
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
        chrome: BoardChrome
    } = $props()

    const ChipScale = 0.8
    const ChipHeight = 34

    let short = $derived((long * GuildBox.height) / GuildBox.width)
    let target = $derived(guildTarget(guild))
    let chip = $derived(chipOf(chrome.offer, target))
    let at = $derived(GuildAreas[guild])

    const gameSession = getGameSession()
    let tokens = $derived(
        gameSession.boardAnimator.tokens.filter(({ place }) => guildAreaAt(place) === guild)
    )
</script>

<!-- Upright, the area's own box is the popup's anchor: the turned pick inside it is not. -->
<div
    class="open-guild"
    style:width="{short}px"
    style:height="{long}px"
    data-open-guild={guild}
    data-pick-anchor={target}
>
    <UprightArea {guild} {long}>
        <svg
            class="surface"
            width={long}
            height={short}
            viewBox="{at.x} {at.y} {GuildAreaWidth} {GuildAreaHeight}"
            pointer-events="none"
            data-open-guild-surface
            use:gameSession.boardAnimator.attachArea={guild}
        >
            <BoardGuildArea {guild} {state} {paintOf} {colourPaintOf} {chrome} drawsChip={false} />
            <g data-layer="motion"><BoardMotionLayer {tokens} {paintOf} {colourPaintOf} /></g>
        </svg>
    </UprightArea>
    {#if chip}
        <svg class="chip" width="1" height="1" overflow="visible" data-chip-of={target}>
            <g transform="translate(0 {(ChipHeight / 2) * ChipScale + 6}) scale({ChipScale})">
                <PickChip {chip} />
            </g>
        </svg>
    {/if}
</div>

<style>
    .open-guild {
        position: relative;
        flex: none;
        pointer-events: auto;
    }

    .surface {
        overflow: visible;
    }

    .chip {
        position: absolute;
        top: 0;
        left: 50%;
        pointer-events: none;
    }
</style>
