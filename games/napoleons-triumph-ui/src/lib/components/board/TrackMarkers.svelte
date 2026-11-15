<script lang="ts">
    import { UnitType, type Face } from '@tabletop/napoleons-triumph'
    import type { Point } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MAP_FILE_SCALE } from '$lib/map/battlefield.js'
    import { MARK_INK, MARK_PAPER } from '$lib/utils/approachSymbols.js'
    import { GuardMark } from '$lib/utils/moraleTrack.js'
    import { MORALE_MARKER_RADIUS, TRACK_MARKER_RADIUS } from '$lib/utils/trackMarker.js'
    import UnitFace from '../UnitFace.svelte'
    import UnitSymbol from '../UnitSymbol.svelte'
    import SkullAndCrossbones from './SkullAndCrossbones.svelte'

    const gameSession = getGameSession()

    const BLACK = '#1d1b18'
    const HEAVY_CAVALRY: Face = { type: UnitType.Cavalry, strength: 1 }
    const GUARD: Face = { type: UnitType.Infantry, strength: 1, guard: true }
    const SYMBOL_WIDTH = 15
    const SYMBOL_HEIGHT = 10.5
    const SYMBOL_PITCH = SYMBOL_HEIGHT + 2
    const INVERTED_LINE_WIDTH = 1.2
    // Measured on the designer's public map file, in its points: the printed commander's emblem.
    const EMBLEM_SIZE = 26 * MAP_FILE_SCALE

    const upright = $derived(-gameSession.boardRotation)
</script>

{#snippet disc(track: string, at: Point, fill: string, radius: number)}
    <circle
        cx={at.x}
        cy={at.y}
        r={radius}
        {fill}
        filter="url(#nt-contact-shadow)"
        data-track-marker={track}
    ></circle>
{/snippet}

{#snippet invertedGuard(ink: string, ground: string)}
    <g transform="translate({-SYMBOL_WIDTH / 2} {-SYMBOL_HEIGHT / 2})">
        <UnitSymbol
            type={UnitType.Infantry}
            width={SYMBOL_WIDTH}
            height={SYMBOL_HEIGHT}
            {ink}
            {ground}
            lineWidth={INVERTED_LINE_WIDTH}
            dotRadius={0}
        />
    </g>
{/snippet}

{#snippet skullAndCrossbones(at: Point)}
    <g transform="translate({at.x} {at.y})" data-fallen-commander>
        <rect
            x={-EMBLEM_SIZE / 2}
            y={-EMBLEM_SIZE / 2}
            width={EMBLEM_SIZE}
            height={EMBLEM_SIZE}
            fill={MARK_PAPER}
            stroke={MARK_INK}
            stroke-width={0.8}
        ></rect>
        <g transform="rotate({upright})"><SkullAndCrossbones size={EMBLEM_SIZE} /></g>
    </g>
{/snippet}

<g class="pointer-events-none">
    {#each gameSession.fallenCommanderEmblems as at (`${at.x}:${at.y}`)}
        {@render skullAndCrossbones(at)}
    {/each}
    {#each gameSession.commandDiscs as { at, independentOf } (`${at.x}:${at.y}`)}
        {@render disc(
            'command',
            at,
            independentOf ? gameSession.armyColors(independentOf).block : BLACK,
            TRACK_MARKER_RADIUS
        )}
    {/each}
    {@render disc('time', gameSession.timeMarker, BLACK, TRACK_MARKER_RADIUS)}
    {#each gameSession.moraleMarkers as { playerId, at } (playerId)}
        {@render disc('morale', at, gameSession.armyColors(playerId).block, MORALE_MARKER_RADIUS)}
    {/each}
    {#each gameSession.moraleMarkers as { playerId, at, heavyCavalryCommitted, guard } (playerId)}
        {@const colors = gameSession.armyColors(playerId)}
        <g
            transform="translate({at.x} {at.y}) rotate({upright})"
            data-heavy-cavalry-committed={heavyCavalryCommitted ? '' : undefined}
            data-guard={guard}
        >
            {#if heavyCavalryCommitted}
                <g transform="translate(0 {-SYMBOL_PITCH / 2})">
                    <UnitFace
                        face={HEAVY_CAVALRY}
                        ink={colors.ink}
                        ground={colors.block}
                        symbolWidth={SYMBOL_WIDTH}
                        symbolHeight={SYMBOL_HEIGHT}
                    />
                </g>
            {/if}
            {#if guard}
                <g transform="translate(0 {SYMBOL_PITCH / 2})">
                    {#if guard === GuardMark.Failed}
                        {@render invertedGuard(colors.ink, colors.block)}
                    {:else}
                        <UnitFace
                            face={GUARD}
                            ink={colors.ink}
                            ground={colors.block}
                            symbolWidth={SYMBOL_WIDTH}
                            symbolHeight={SYMBOL_HEIGHT}
                        />
                    {/if}
                </g>
            {/if}
        </g>
    {/each}
</g>
