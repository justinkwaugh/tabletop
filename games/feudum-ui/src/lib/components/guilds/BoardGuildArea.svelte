<script lang="ts">
    import type { Color } from '@tabletop/common'
    import { GuildById, type GuildId, type HydratedFeudumGameState } from '@tabletop/feudum'
    import DimVeil from '$lib/components/map/DimVeil.svelte'
    import PickChrome from '$lib/components/map/PickChrome.svelte'
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import { PlainChrome, dimmed, isPickable, type BoardChrome } from '$lib/model/boardChrome.js'
    import { guildTarget, roleOf } from '$lib/model/boardOffer.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { GuildAreaHeight, GuildAreaWidth, GuildAreas } from '$lib/utils/boardGeometry.js'
    import GuildArea from './GuildArea.svelte'

    /**
     * R-1.2.3 One guild area where it stands on the board, in board units: on a phone's board, or
     * behind a desk's side button. A press on it enlarges it, at any time, unless the same press picks
     * it (contract: Card preview). The press stands under the area, so a bead on it still enlarges
     * alone. Where the area stands upright off the board its chip is drawn upright beside it instead
     * (`drawsChip`).
     */
    let {
        guild,
        state,
        paintOf,
        colourPaintOf,
        chrome = PlainChrome,
        drawsChip = true
    }: {
        guild: GuildId
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
        chrome?: BoardChrome
        drawsChip?: boolean
    } = $props()

    let target = $derived(guildTarget(guild))
    let at = $derived(GuildAreas[guild])
</script>

<Enlargeable
    label="{GuildById[guild].name} guild"
    off={isPickable(roleOf(chrome.offer, target))}
    face={() => ({ kind: 'guild', guild, state, paintOf, colourPaintOf })}
>
    <rect x={at.x} y={at.y} width={GuildAreaWidth} height={GuildAreaHeight} fill="transparent"
    ></rect>
</Enlargeable>
<GuildArea {guild} {state} {paintOf} {colourPaintOf} x={at.x} y={at.y} />
{#if dimmed(roleOf(chrome.offer, target)) !== undefined}
    <DimVeil x={at.x} y={at.y} width={GuildAreaWidth} height={GuildAreaHeight} />
{/if}
<PickChrome
    {target}
    {chrome}
    at={{ x: at.x + GuildAreaWidth / 2, y: at.y + GuildAreaHeight / 2 }}
    width={GuildAreaWidth}
    height={GuildAreaHeight}
    round={false}
    label={guild}
    {drawsChip}
/>
