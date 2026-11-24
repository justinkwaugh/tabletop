<script lang="ts">
    import { GuildTrackSpaces, type GuildId, type HydratedFeudumGameState } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        GuildSizes,
        RankRadius,
        guildPrinted,
        guildSlot,
        reeveOffset
    } from '$lib/utils/boardGeometry.js'
    import { hexagonPoints } from '$lib/utils/trackShape.js'

    /** R-4.5.3 The apprentice space is used only at 4 and 5 players. */
    let {
        guild,
        state,
        paintOf
    }: {
        guild: GuildId
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
    } = $props()

    let spaces = $derived(GuildTrackSpaces.filter((space) => space.guild === guild))
    let track = $derived(state.guilds.tracks[guild])
    let printed = $derived(guildPrinted(guild))
    let reeve = $derived(reeveOffset(guild))

    const VeilRadius = 22
</script>

{#each spaces as space (space.id)}
    {@const at = guildSlot(space.id)}
    {@const holder = track[space.rank]}
    {@const unused = state.players.length < space.minPlayers}
    <g
        data-rank={space.rank}
        data-unused={unused ? '' : undefined}
        opacity={unused && !printed ? 0.4 : undefined}
    >
        {#if printed}
            {#if unused}
                <polygon
                    data-veil
                    points={hexagonPoints(VeilRadius)}
                    transform="translate({at.x} {at.y})"
                    fill="var(--feudum-surface)"
                    fill-opacity="0.6"
                ></polygon>
            {/if}
        {:else}
            <polygon
                points={hexagonPoints(RankRadius)}
                transform="translate({at.x} {at.y})"
                fill="var(--feudum-parchment-shade)"
                stroke="var(--feudum-ink)"
                stroke-width="2"
            ></polygon>
            <text
                data-print-stand-in
                x={at.x}
                y={at.y + RankRadius + 13}
                text-anchor="middle"
                font-size="13"
                fill="var(--feudum-ink)"
                >{space.rank.charAt(0).toUpperCase()} · {space.dawnVp} vp</text
            >
        {/if}
    </g>
    {#if holder}
        <BoardPiece {at} piece="rank:{space.id}">
            <SeatToken
                kind="marker"
                paint={paintOf(holder.playerId)}
                size={GuildSizes.marker}
                x={-GuildSizes.marker / 2}
                y={-GuildSizes.marker / 2}
            />
        </BoardPiece>
        {#if holder.reeve}
            <BoardPiece at={{ x: at.x + reeve.x, y: at.y + reeve.y }} piece="reeve:{space.id}">
                <SeatToken
                    kind="reeve"
                    paint={paintOf(holder.playerId)}
                    size={GuildSizes.reeve}
                    x={-GuildSizes.reeve / 2}
                    y={-GuildSizes.reeve / 2}
                />
            </BoardPiece>
        {/if}
    {/if}
{/each}
