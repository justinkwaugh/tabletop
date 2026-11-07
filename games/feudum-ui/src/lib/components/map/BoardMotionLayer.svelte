<script lang="ts">
    import type { Color } from '@tabletop/common'
    import type { MotionToken } from '$lib/animators/boardPlan.js'
    import ActionCardFace from '$lib/components/pieces/ActionCardFace.svelte'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import LocationDisc from '$lib/components/pieces/LocationDisc.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import TileFace from '$lib/components/pieces/TileFace.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        DieSize,
        DiscFrame,
        ImmunitySealSize,
        StackSize,
        VesselSize
    } from '$lib/utils/boardGeometry.js'
    import RouteGlyph from './RouteGlyph.svelte'

    /**
     * What stands in for a piece while it moves. Each token is written once, hidden, at its first
     * place; the animator owns its transform and opacity from then until the state shows.
     */
    let {
        tokens,
        paintOf,
        colourPaintOf
    }: {
        tokens: readonly MotionToken[]
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
    } = $props()

    const CardWidth = 40
    const GlowRadius = 26
    const ChipLetter = 9
    const ChipPadding = 10
</script>

{#each tokens as { id, face, place, scaleX } (id)}
    <g
        data-transient={id}
        data-token={face.kind}
        opacity="0"
        transform="translate({place.x} {place.y}) scale({scaleX ?? 1} 1)"
    >
        {#if face.kind === 'good'}
            <GoodToken good={face.good} size={face.size} x={-face.size / 2} y={-face.size / 2} />
        {:else if face.kind === 'marker'}
            <SeatToken
                kind="marker"
                paint={'playerId' in face.owner
                    ? paintOf(face.owner.playerId)
                    : colourPaintOf(face.owner.colour)}
                size={face.size}
                x={-face.size / 2}
                y={-face.size / 2}
            />
        {:else if face.kind === 'vessel'}
            <VesselToken
                vessel={face.vessel}
                size={VesselSize}
                x={-VesselSize / 2}
                y={-VesselSize / 2}
            />
        {:else if face.kind === 'ferry'}
            <RouteGlyph medium="ferry" x={0} y={0} />
        {:else if face.kind === 'location'}
            <LocationDisc
                kind={face.location}
                guild={face.guild}
                start={face.start}
                size={DiscFrame}
                x={-DiscFrame / 2}
                y={-DiscFrame / 2}
            />
        {:else if face.kind === 'seal'}
            <SealFace
                faceShown={false}
                size={ImmunitySealSize}
                x={-ImmunitySealSize / 2}
                y={-ImmunitySealSize / 2}
            />
        {:else if face.kind === 'die-face'}
            <rect
                x={-DieSize / 2}
                y={-DieSize / 2}
                width={DieSize}
                height={DieSize}
                rx="7"
                fill="var(--feudum-parchment)"
                stroke="var(--feudum-wood-dark)"
                stroke-width="2"
            ></rect>
            <text
                y="4"
                text-anchor="middle"
                font-size="10"
                font-weight="700"
                fill="var(--feudum-ink)"
                style:font-family="var(--feudum-font-text)">{face.region}</text
            >
        {:else if face.kind === 'tile'}
            <TileFace
                faceShown={true}
                epoch={face.epoch}
                landscape={face.landscape}
                size={StackSize}
                x={-StackSize / 2}
                y={-StackSize / 2}
            />
        {:else if face.kind === 'chip'}
            {@const width = ChipPadding * 2 + face.text.length * ChipLetter}
            <rect
                x={-width / 2}
                y="-12"
                {width}
                height="24"
                rx="12"
                fill={face.rose ? 'var(--feudum-danger-soft)' : 'var(--feudum-surface-raised)'}
                stroke={face.rose ? 'var(--feudum-danger)' : 'var(--feudum-halo)'}
                stroke-width="2"
            ></rect>
            <text
                y="5"
                text-anchor="middle"
                font-size="14"
                font-weight="700"
                fill={face.rose ? 'var(--feudum-danger)' : 'var(--feudum-text)'}>{face.text}</text
            >
        {:else if face.kind === 'defend'}
            <ActionCardFace
                faceShown={true}
                kind="defend"
                paint={paintOf(face.playerId)}
                width={CardWidth}
                x={-CardWidth / 2}
                y={-CardWidth * 0.7}
            />
        {:else if face.kind === 'glow'}
            <circle r={GlowRadius} fill="none" stroke="var(--feudum-wood-piece)" stroke-width="5"
            ></circle>
        {/if}
    </g>
{/each}
