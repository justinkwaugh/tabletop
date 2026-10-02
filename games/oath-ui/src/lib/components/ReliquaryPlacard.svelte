<script lang="ts">
    import { CardKind } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import {
        RELIQUARY_PLACARD,
        reliquaryPlacardImage,
        reliquaryTraitImage
    } from '$lib/images/tileImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName, reliquaryLabel } from '$lib/model/names.js'
    import { reliquarySpaces } from '$lib/model/reliquary.js'
    import { inspectImage } from '$lib/model/inspectImage.svelte.js'
    import { reliquaryTraitPreview } from '$lib/model/seatPreviews.js'

    // R-2.3, R-6.4-H1, R-6.6.2.a — a covered space shows its relic to whoever knows it, an uncovered one its trait.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)

    const RELIC_THUMB = 52
</script>

<div class="placard" style="--placard-w:{Math.round(RELIC_THUMB / RELIQUARY_PLACARD.space)}px;">
    <img class="placard__art" src={reliquaryPlacardImage()} alt="Imperial Reliquary" />
    {#each reliquarySpaces(gameState) as space, index (space.slotId)}
        {@const slotId = space.slotId}
        {@const known = space.covered ? gameSession.knownRelicAt(slotId) : undefined}
        <div
            class="space"
            style="left:{RELIQUARY_PLACARD.centers[index] * 100}%; top:{RELIQUARY_PLACARD.cy *
                100}%;"
        >
            {#if !space.covered}
                <figure
                    class="trait"
                    use:inspectImage={{
                        preview: reliquaryTraitPreview(index, reliquaryLabel(slotId))
                    }}
                >
                    <img
                        src={reliquaryTraitImage(index)}
                        alt="{reliquaryLabel(slotId)}, uncovered: the Chancellor holds this trait"
                    />
                </figure>
            {:else}
                <CardImage
                    cardId={known}
                    back={known === undefined ? CardKind.Relic : undefined}
                    width={RELIC_THUMB}
                    label={known ? cardName(known) : 'Facedown relic on ' + reliquaryLabel(slotId)}
                    inspect
                />
            {/if}
        </div>
    {/each}
</div>

<style>
    .placard {
        position: relative;
        width: var(--placard-w);
        margin: 8px auto 10px;
        line-height: 0;
    }
    .placard__art {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 6px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
    }
    /* Explicit size: an absolutely positioned box otherwise shrinks to the room
       left of its `left`, squeezing the fourth space. */
    .space {
        position: absolute;
        width: 52px;
        height: 52px;
        transform: translate(-50%, -50%);
        line-height: 0;
    }
    .space :global(img) {
        max-width: none;
    }
    /* An uncovered space shows the placard's print; the trait enlarges as every card does. */
    .trait {
        position: relative;
        margin: 0;
    }
    .trait img {
        display: block;
        width: 52px;
        height: 52px;
        object-fit: cover;
        border-radius: 4px;
        opacity: 0;
    }
</style>
