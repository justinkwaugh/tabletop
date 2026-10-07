<script lang="ts">
    import type { CitizenshipTransfer } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import { bannerImage, favorToken, secretToken } from '$lib/images/tileImages.js'
    import { bannerName, bannerTokenKind, cardName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-6.6.1 — one side of the binding exchange as the pieces it moves. Counts the player gives
    // are gold, as a cost is; what they receive stays plain.
    let {
        transfer,
        gives,
        cardHeight
    }: { transfer: CitizenshipTransfer | undefined; gives: boolean; cardHeight: number } = $props()

    let gameState = $derived(getGameSession().gameState)

    const TOKEN_WIDTH = 26
    // Named as TokenText names a count: 'favor' at any count, 'secret' for one, 'secrets' otherwise.
    let tokens = $derived(
        [
            { kind: 'favor', count: transfer?.favor ?? 0, image: favorToken() },
            { kind: 'secret', count: transfer?.secrets ?? 0, image: secretToken() }
        ]
            .filter((token) => token.count > 0)
            .map((token) => ({
                ...token,
                noun: token.kind === 'favor' ? 'favor' : token.count === 1 ? 'secret' : 'secrets'
            }))
    )
</script>

{#each transfer?.relicCardIds ?? [] as relicId (relicId)}
    <span class="relative inline-flex">
        <CardImage cardId={relicId} width={widthAtHeight(cardHeight, { cardId: relicId })} />
        <Magnifier
            preview={{ cardId: relicId, label: cardName(relicId) }}
            label={cardName(relicId)}
        />
    </span>
{/each}
{#each transfer?.banners ?? [] as banner (banner)}
    {@const src = bannerImage(banner, gameState.isOnMobSide(banner))}
    {@const label = `the ${bannerName(banner)}`}
    <span class="relative inline-flex">
        <img
            {src}
            alt={label}
            title={label}
            class="rounded-[4px] shadow-md"
            style="height:{cardHeight}px; width:{cardHeight * 2}px;"
        />
        <Magnifier
            preview={{
                imageSrc: src,
                aspect: 2,
                label,
                badge: { kind: bannerTokenKind(banner), count: gameState.banners[banner].value }
            }}
            {label}
        />
    </span>
{/each}
{#each tokens as token (token.kind)}
    <span
        role="img"
        aria-label="{token.count} {token.noun}"
        class="inline-flex items-center gap-[3px] font-bold"
    >
        <span class="count" class:text-oath-accent={gives}>{token.count}</span>
        <img
            src={token.image.src}
            alt=""
            style="width:{TOKEN_WIDTH}px; height:{Math.round(
                (TOKEN_WIDTH * token.image.height) / token.image.width
            )}px;"
        />
    </span>
{/each}
