<script lang="ts">
    import ActionCardFace from '$lib/components/pieces/ActionCardFace.svelte'
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import type { SeatCardsItem } from '$lib/model/seatLines.js'

    /**
     * Contract, Seat panel, the cards line: another seat's hand as backs with the count, the seat's
     * own as a count (its desk shows the hand), then the played cards, each use but regular a corner
     * badge that the card's tooltip names.
     */
    let {
        items,
        paint,
        scale
    }: { items: readonly SeatCardsItem[]; paint: SeatPaint; scale: number } = $props()

    const CardWidth = 18
    const BackOverlap = 0.6
    let width = $derived(CardWidth * scale)

    const Badges: Readonly<Record<string, string>> = {
        special: '★',
        forfeited: '✕',
        'flipped as Defend': '⇅'
    }

    function badgeOf(mark: string): string | undefined {
        if (mark === 'regular') {
            return undefined
        }
        return Badges[mark] ?? '↻'
    }
</script>

<div
    class="line flex flex-wrap items-center gap-[0.3em]"
    data-seat-line="cards"
    data-seat-section="cards"
>
    {#each items as entry, index (index)}
        {#if entry.item === 'backs'}
            <span class="flex items-center gap-[0.3em]" data-hand-backs={entry.count}>
                <Enlargeable
                    tag="div"
                    label="card back"
                    face={() => ({ kind: 'card', faceShown: false, paint })}
                >
                    <span class="flex">
                        {#each Array.from({ length: entry.count }, (_, back) => back) as back (back)}
                            <span style:margin-left={back === 0 ? 0 : `${-width * BackOverlap}px`}>
                                <ActionCardFace faceShown={false} {paint} {width} />
                            </span>
                        {/each}
                    </span>
                </Enlargeable>
                <span class="label">{entry.count} in hand</span>
            </span>
        {:else if entry.item === 'in-hand'}
            <span class="label" data-in-hand={entry.count}>{entry.count} in hand</span>
        {:else if entry.item === 'choosing'}
            <span class="label italic" data-pouch="choosing">choosing</span>
        {:else}
            {@const card = entry.card}
            {@const mark = entry.item === 'played' ? entry.card.mark : undefined}
            {@const badge = mark ? badgeOf(mark) : undefined}
            <div
                class="relative"
                data-card-mark={mark}
                title={badge ? `${card.name} card, ${mark}` : `${card.name} card`}
            >
                <Enlargeable
                    tag="div"
                    label="{card.name} card"
                    face={() => ({
                        kind: 'card',
                        faceShown: true,
                        card: card.kind,
                        number: card.number,
                        paint
                    })}
                >
                    <div
                        data-seat-card={card.kind}
                        data-card-played={entry.item === 'played' ? '' : undefined}
                    >
                        <ActionCardFace
                            faceShown={true}
                            kind={card.kind}
                            number={card.number}
                            {paint}
                            {width}
                        />
                    </div>
                </Enlargeable>
                {#if badge}
                    <span class="badge" aria-hidden="true" data-card-badge>{badge}</span>
                {/if}
            </div>
        {/if}
    {/each}
</div>

<style>
    .label {
        font-size: 0.85em;
        color: var(--feudum-wood-dark);
    }

    .badge {
        position: absolute;
        top: -0.35em;
        right: -0.35em;
        min-width: 1.15em;
        height: 1.15em;
        border-radius: 50%;
        background: var(--feudum-ink);
        color: var(--feudum-parchment);
        font-size: 0.7em;
        line-height: 1.15em;
        text-align: center;
        pointer-events: none;
    }
</style>
