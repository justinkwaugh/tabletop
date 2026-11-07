<script lang="ts">
    import ActionCardFace from '$lib/components/pieces/ActionCardFace.svelte'
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import type { SeatCards } from '$lib/model/seatPanel.js'

    /** Contract, Seat panel: played cards in play order, then the hand or a stack of its backs. */
    let { cards, paint, scale }: { cards: SeatCards; paint: SeatPaint; scale: number } = $props()

    const CardWidth = 42
    let width = $derived(CardWidth * scale)
</script>

<section class="flex flex-wrap items-start gap-[0.3em]" data-seat-section="cards">
    {#each cards.played as card, index (index)}
        <div class="flex flex-col items-center" style:width="{width}px">
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
                <div data-seat-card={card.kind} data-card-played>
                    <ActionCardFace
                        faceShown={true}
                        kind={card.kind}
                        number={card.number}
                        {paint}
                        {width}
                    />
                </div>
            </Enlargeable>
            <span class="mark" data-card-mark>{card.mark}</span>
        </div>
    {/each}
    {#each cards.unplayed as card (card.kind)}
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
                class:set-aside={card.setAside}
                data-seat-card={card.kind}
                data-set-aside={card.setAside ? '' : undefined}
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
    {/each}
    {#if cards.handBacks > 0}
        <div class="flex items-center gap-[0.3em]" data-hand-backs={cards.handBacks}>
            <Enlargeable
                tag="div"
                label="card back"
                face={() => ({ kind: 'card', faceShown: false, paint })}
            >
                <ActionCardFace faceShown={false} {paint} {width} />
            </Enlargeable>
            <span class="font-bold">×{cards.handBacks}</span>
        </div>
    {/if}
</section>

<style>
    .mark {
        width: 100%;
        text-align: center;
        font-size: 0.7em;
        line-height: 1;
        padding-top: 0.15em;
        font-style: italic;
    }

    .set-aside {
        opacity: 0.4;
    }
</style>
