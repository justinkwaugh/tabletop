<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { TalonPlace } from '$lib/utils/talonView.js'
    import Card from './Card.svelte'
    import CardBack from './CardBack.svelte'

    // The talon is drawn in the middle of the table or in the corner; each place draws it only while
    // it is there.
    let { place }: { place: TalonPlace } = $props()

    const gameSession = getGameSession()
    const view = $derived(gameSession.talonView)
    const here = $derived(view.kind !== 'gone' && view.place === place)
</script>

{#snippet faceUp(cardId: string)}
    <!-- The back is shown only while the card turns over. -->
    <div class="talon-card" {@attach gameSession.cardPlaces.talonCard(cardId)}>
        <Card {cardId} style={gameSession.cardStyle} />
        <div class="flip-back"><CardBack /></div>
    </div>
{/snippet}

<div class="talon {place}" {@attach gameSession.cardPlaces.talonSlot(place)}>
    {#if here}
        <div class="label">Talon</div>
        {#if view.kind === 'halves'}
            <div class="halves">
                {#each view.halves as half, index (index)}
                    <button
                        type="button"
                        class="half"
                        class:choosable={gameSession.canChooseTalonHalf}
                        disabled={!gameSession.canChooseTalonHalf}
                        aria-label="Take talon half {index + 1}"
                        onclick={() => gameSession.chooseTalonHalf(index)}
                    >
                        {#each half as cardId (cardId)}
                            {@render faceUp(cardId)}
                        {/each}
                    </button>
                {/each}
            </div>
        {:else if view.kind === 'half'}
            <div class="half waiting">
                {#each view.cards as cardId (cardId)}
                    {@render faceUp(cardId)}
                {/each}
            </div>
        {:else if view.kind === 'stack'}
            <div class="stack" {@attach gameSession.cardPlaces.talonStack()}>
                <!-- Two piles of three, as the halves it turns up into. -->
                {#each { length: 6 }, index (index)}
                    <div class="back" style:--pile={Math.floor(index / 3)} style:--i={index % 3}>
                        <CardBack />
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style>
    .talon {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        color: #f1e7cf;
    }

    .corner {
        --card-w: 56px;
        --pile-gap: 10px;
    }

    .middle {
        --card-w: 86px;
        --pile-gap: 18px;
    }

    .label {
        font-size: 0.75rem;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        opacity: 0.8;
    }

    .halves {
        display: flex;
        gap: 28px;
    }

    .half {
        display: flex;
        gap: 4px;
        padding: 6px;
        border-radius: 8px;
        border: 2px solid transparent;
    }

    .half.choosable {
        cursor: pointer;
        border-color: #f2c94c;
        background: rgb(242 201 76 / 0.12);
    }

    .half.choosable:hover {
        background: rgb(242 201 76 / 0.28);
    }

    .talon-card {
        position: relative;
    }

    .flip-back {
        position: absolute;
        inset: 0;
        opacity: 0;
    }

    .stack {
        --pile-w: calc(var(--card-w) + 10px);
        position: relative;
        width: calc(2 * var(--pile-w) + var(--pile-gap));
        height: calc(var(--card-w) * 1.8);
    }

    .back {
        position: absolute;
        left: calc(var(--pile) * (var(--pile-w) + var(--pile-gap)) + var(--i) * 5px);
        top: 0;
    }
</style>
