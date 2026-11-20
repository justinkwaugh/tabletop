<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import LocationDisc from '$lib/components/pieces/LocationDisc.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import type { BoardChip, ChipArt } from '$lib/model/boardOffer.js'
    import {
        ChipGap,
        ChipHeight,
        ChipPieceSize,
        ChipStepWidth,
        chipLayout,
        type PlacedArt
    } from '$lib/model/spaceChips.js'

    /** Contract, Pick conventions: rose a cost or a threat, amber what is yours to take. */
    let {
        chip,
        y = 0,
        press
    }: {
        chip: BoardChip
        y?: number
        press?: () => void
    } = $props()

    const Height = ChipHeight
    const PieceSize = ChipPieceSize
    const StepWidth = ChipStepWidth
    const Gap = ChipGap

    type Placed = ChipArt & PlacedArt

    let layout = $derived(chipLayout(chip))
    let drawn = $derived({
        pieces: (chip.art ?? []).map((art, index): Placed => ({ ...art, ...layout.pieces[index] }))
    })
    let width = $derived(layout.width)
    let rose = $derived(chip.tone === 'rose')
    let ink = $derived(rose ? 'var(--feudum-danger)' : 'var(--feudum-accent)')

    /** A touch browser aims a tap at the nearest listener; a delegated one leaves it deaf. */
    function answers(onPress: () => void): Attachment<SVGRectElement> {
        return (node) => {
            node.addEventListener('click', onPress)
            return () => node.removeEventListener('click', onPress)
        }
    }
</script>

<g
    transform="translate(0 {y})"
    data-chip={chip.tone}
    role={chip.art ? 'img' : undefined}
    aria-label={chip.art ? chip.label : undefined}
>
    <rect
        x={-width / 2}
        y={-Height / 2}
        {width}
        height={Height}
        rx={Height / 2}
        fill={rose ? 'var(--feudum-danger-soft)' : 'var(--feudum-primary)'}
        stroke="var(--feudum-halo)"
        stroke-width="3"
    ></rect>
    {#if chip.art}
        {#each drawn.pieces as piece, index (index)}
            {@const left = piece.x - width / 2}
            {#if piece.kind === 'step'}
                <path
                    data-chip-step
                    d="M {left} 0 H {left + StepWidth - 4} M {left + StepWidth - 10} -6 L {left +
                        StepWidth -
                        4} 0 L {left + StepWidth - 10} 6"
                    fill="none"
                    stroke={ink}
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                ></path>
            {:else if piece.kind === 'disc'}
                <LocationDisc kind={piece.location} size={PieceSize} x={left} y={-PieceSize / 2} />
            {:else}
                {#if piece.kind === 'good'}
                    <GoodToken good={piece.good} size={PieceSize} x={left} y={-PieceSize / 2} />
                {:else}
                    <SealFace faceShown={false} size={PieceSize} x={left} y={-PieceSize / 2} />
                {/if}
                <text
                    x={left + PieceSize + Gap}
                    y="8"
                    font-size="23"
                    font-weight="700"
                    fill={ink}
                    style:font-family="var(--feudum-font-text)">{piece.text}</text
                >
            {/if}
        {/each}
    {:else}
        <text
            y="8"
            text-anchor="middle"
            font-size="23"
            font-weight="700"
            fill={ink}
            style:font-family="var(--feudum-font-text)">{chip.label}</text
        >
    {/if}
    {#if press}
        <!-- A pointer on the chip reaches its target; the target's own press stays its button. -->
        <rect
            x={-width / 2}
            y={-Height / 2}
            {width}
            height={Height}
            rx={Height / 2}
            fill="transparent"
            aria-hidden="true"
            pointer-events="all"
            cursor="pointer"
            data-chip-press
            {@attach answers(press)}
        ></rect>
    {/if}
</g>
