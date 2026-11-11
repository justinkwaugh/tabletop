<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import type { BoardChip } from '$lib/model/boardOffer.js'

    /**
     * Contract, Pick conventions: a short note on a target. Rose carries a cost or a threat, amber
     * what is yours to take; each over the dark halo, so no ground stands in for it. A chip that
     * costs goods draws each good with its count; its words stay its accessible name.
     */
    let { chip, y = 0 }: { chip: BoardChip; y?: number } = $props()

    const Height = 34
    const CharWidth = 13.5
    const GoodSize = 24
    const Gap = 4
    const Padding = 10

    /** Each good's art and count from the chip's left edge, and the width they take. */
    let drawn = $derived.by(() => {
        let x = Padding
        const goods = (chip.goods ?? []).map(({ good, count }) => {
            const at = x
            const text = String(count)
            x += GoodSize + Gap + text.length * CharWidth + Gap
            return { good, text, x: at }
        })
        return { goods, width: x - Gap + Padding }
    })
    let width = $derived(chip.goods ? drawn.width : 20 + chip.label.length * CharWidth)
    let rose = $derived(chip.tone === 'rose')
    let ink = $derived(rose ? 'var(--feudum-danger)' : 'var(--feudum-accent)')
</script>

<g
    transform="translate(0 {y})"
    data-chip={chip.tone}
    role={chip.goods ? 'img' : undefined}
    aria-label={chip.goods ? chip.label : undefined}
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
    {#if chip.goods}
        {#each drawn.goods as { good, text, x } (good)}
            <GoodToken {good} size={GoodSize} x={x - width / 2} y={-GoodSize / 2} />
            <text
                x={x - width / 2 + GoodSize + Gap}
                y="8"
                font-size="23"
                font-weight="700"
                fill={ink}
                style:font-family="var(--feudum-font-text)">{text}</text
            >
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
