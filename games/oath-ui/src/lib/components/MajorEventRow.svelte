<script lang="ts">
    import type { Snippet } from 'svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import TokenText from '$lib/components/TokenText.svelte'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { bannerImage, oathkeeperTileImage } from '$lib/images/tileImages.js'
    import { endDieImage } from '$lib/images/diceImages.js'
    import { bannerName, cardName } from '$lib/model/names.js'
    import type { EventPicture, MajorEvent } from '$lib/model/majorEvents.js'

    let { event, actorId, children }: { event: MajorEvent; actorId?: string; children: Snippet } =
        $props()

    function source(picture: EventPicture): string | undefined {
        switch (picture.kind) {
            case 'card':
                return cardImage(picture.cardId)
            case 'back':
                return cardBack(picture.cardKind)
            case 'title':
                return oathkeeperTileImage(picture.usurper)
            case 'banner':
                return bannerImage(picture.banner)
            case 'die':
                return endDieImage(picture.value)
        }
    }

    function alt(picture: EventPicture): string {
        switch (picture.kind) {
            case 'card':
                return cardName(picture.cardId)
            case 'back':
                return 'a Vision, facedown'
            case 'title':
                return picture.usurper ? 'the Usurper title' : 'the Oathkeeper title'
            case 'banner':
                return `the ${bannerName(picture.banner)}`
            case 'die':
                return `the end die showing ${picture.value}`
        }
    }
</script>

<article
    class="major-event mt-1 rounded-md border bg-oath-surface-raised px-2 pt-1.5 pb-2 text-left {event.tone ===
    'danger'
        ? 'border-oath-danger/45'
        : 'border-oath-frame'}"
    data-major-event={event.kind}
>
    <div class="flex justify-between gap-1.5">
        <span
            class="text-[11px] font-bold uppercase tracking-[0.1em] {event.tone === 'danger'
                ? 'text-oath-danger'
                : 'text-oath-heading'}">{event.heading}</span
        >
        {#if event.aside}
            <span class="text-xs text-oath-text-muted">{event.aside}</span>
        {/if}
    </div>
    <p class="mt-0.5 text-sm text-oath-text">
        {#if actorId}<PlayerName playerId={actorId} />{/if}
        {@render children()}
    </p>
    {#if event.pictures.length > 0}
        <div class="mt-1.5 flex items-end gap-1.5">
            {#each event.pictures as picture, i (i)}
                {@const src = source(picture)}
                {#if src}
                    <img
                        class="major-event__picture major-event__picture--{picture.kind}"
                        {src}
                        alt={alt(picture)}
                        title={alt(picture)}
                    />
                {/if}
            {/each}
        </div>
    {/if}
    {#if event.consequence}
        <p class="mt-1 text-xs text-oath-text-muted"><TokenText text={event.consequence} /></p>
    {/if}
</article>

<style>
    .major-event__picture {
        display: block;
        height: 56px;
        width: auto;
        border-radius: 4px;
    }
    .major-event__picture--title,
    .major-event__picture--banner {
        height: 44px;
    }
    .major-event__picture--die {
        height: 40px;
        width: 40px;
    }
</style>
