<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import LocationDisc from '$lib/components/pieces/LocationDisc.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import type { BoardChip, ChipArt } from '$lib/model/boardOffer.js'

    /**
     * Contract, Pick conventions: a short note on a target. Rose carries a cost or a threat, amber
     * what is yours to take; each over the dark halo, so no ground stands in for it. A chip drawn as
     * art shows its pieces (a disc, the arrow of a step, a good or seal with its count) in place of
     * the words, which stay its accessible name.
     */
    let { chip, y = 0 }: { chip: BoardChip; y?: number } = $props()

    const Height = 34
    const CharWidth = 13.5
    const PieceSize = 24
    const StepWidth = 18
    const Gap = 4
    const Padding = 10

    type Placed = ChipArt & { readonly x: number; readonly text?: string }

    /** Each piece's place from the chip's left edge, and the width they take. */
    let drawn = $derived.by(() => {
        let x = Padding
        const pieces = (chip.art ?? []).map((art): Placed => {
            const at = x
            if (art.kind === 'step') {
                x += StepWidth + Gap
                return { ...art, x: at }
            }
            if (art.kind === 'disc') {
                x += PieceSize + Gap
                return { ...art, x: at }
            }
            const text = String(art.count)
            x += PieceSize + Gap + text.length * CharWidth + Gap
            return { ...art, x: at, text }
        })
        return { pieces, width: x - Gap + Padding }
    })
    let width = $derived(chip.art ? drawn.width : 20 + chip.label.length * CharWidth)
    let rose = $derived(chip.tone === 'rose')
    let ink = $derived(rose ? 'var(--feudum-danger)' : 'var(--feudum-accent)')
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
</g>
