<script lang="ts">
    import { shareFaceImage } from '$lib/images/cardImages.js'
    import { PreviewKind } from '$lib/model/cardPreview.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_TAGS } from '$lib/model/railroadTags.js'
    import type { ShareBlockView } from '$lib/model/turnPanel.js'

    let { shares }: { shares: ShareBlockView } = $props()

    const gameSession = getGameSession()
</script>

<!-- R-2.2, R-2.2-H1, R-2.2-H2: two trades, before the first placement or after the last. -->
<section class="pp-block min-w-0 flex-1">
    <div class="pp-block-heading">{shares.heading}</div>
    {#if shares.lockedNote}
        <p class="text-xs text-pp-ink-sub">{shares.lockedNote}</p>
    {/if}
    <!-- Contract, "Phone layout": while locked a phone keeps only the note, so the board keeps its room. -->
    <div
        class="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2.5 max-sm:mt-0.5 max-sm:gap-x-1.5 max-sm:gap-y-1 xl:grid-cols-4 {shares.lockedNote ===
        undefined
            ? ''
            : 'max-sm:hidden'}"
    >
        {#each shares.entries as share (share.railroadId)}
            {@const face = shareFaceImage(share.railroadId)}
            <div class="entry" class:dimmed={shares.lockedNote !== undefined}>
                <!-- Contract, "The principle": a press on a share face enlarges it and does nothing else. -->
                <button
                    type="button"
                    class="face"
                    aria-label="Enlarge the {share.name} share"
                    data-share-face={share.railroadId}
                    onclick={() =>
                        gameSession.cardPreview.show({
                            kind: PreviewKind.Share,
                            railroadId: share.railroadId
                        })}
                >
                    <img
                        src={face.src}
                        width={38}
                        height={Math.round((38 * face.height) / face.width)}
                        alt="{share.name} share"
                        class="block rounded-[3px]"
                    />
                </button>
                <div class="info min-w-0 text-xs leading-tight text-pp-ink-sub">
                    <div class="text-[13px] font-semibold text-pp-ink max-sm:hidden">
                        {share.name}
                    </div>
                    <span class="tag sm:hidden">{RAILROAD_TAGS[share.railroadId]}</span>
                    <span class="pp-price">${share.price}</span>
                    <span class="max-sm:hidden"
                        >· {share.deckCount} left · you hold {share.held}</span
                    >
                    <span class="phone-figures sm:hidden"
                        >{share.deckCount} left<br />hold {share.held}</span
                    >
                </div>
                <div class="trade">
                    <button
                        type="button"
                        class="pp-button"
                        disabled={!share.canBuy}
                        onclick={() => gameSession.buyShare(share.railroadId)}
                        >Buy <small>{share.buyLabel}</small></button
                    >
                    <button
                        type="button"
                        class="pp-button"
                        disabled={!share.canSell}
                        onclick={() => gameSession.sellShare(share.railroadId)}
                        >Sell <small>{share.sellLabel}</small></button
                    >
                </div>
                {#if share.buyReason}
                    <div class="reason text-[11px] text-pp-ink-sub">{share.buyReason}</div>
                {/if}
            </div>
        {/each}
    </div>
</section>

<style>
    .pp-price {
        font-family: Oswald, sans-serif;
        font-size: 18px;
        color: var(--pp-ink);
    }

    .dimmed {
        opacity: 0.5;
    }

    /* The face beside the name, price, the trade buttons and a dimmed Buy's reason. */
    .entry {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        grid-template-areas:
            'face info'
            'face trade'
            'face reason';
        align-content: center;
        column-gap: 8px;
    }

    .face {
        grid-area: face;
        align-self: center;
    }

    .info {
        grid-area: info;
    }

    .trade {
        grid-area: trade;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
    }

    .reason {
        grid-area: reason;
        margin-top: 2px;
    }

    /* Contract, "Phone layout": face, figures and two 44 px buttons on one row. */
    @media (width < 40rem) {
        .entry {
            grid-template-columns: auto minmax(0, 1fr) auto;
            grid-template-areas:
                'face info trade'
                'reason reason reason';
            align-items: center;
            column-gap: 4px;
            padding: 2px 4px;
            border: 1px solid var(--pp-paper-line);
            border-radius: 6px;
        }

        .face {
            min-height: 44px;
        }

        .face img {
            width: 20px;
            height: auto;
        }

        .info {
            white-space: nowrap;
            overflow: hidden;
            font-size: 10.5px;
            line-height: 1.2;
        }

        .phone-figures {
            display: block;
        }

        .tag {
            font-weight: 600;
            color: var(--pp-ink);
        }

        .pp-price {
            font-size: 14px;
        }

        .trade {
            flex-wrap: nowrap;
            gap: 3px;
            margin-top: 0;
        }

        .trade :global(.pp-button) {
            width: 38px;
            padding: 0;
            font-size: 12.5px;
        }

        .trade :global(.pp-button small) {
            display: none;
        }
    }
</style>
