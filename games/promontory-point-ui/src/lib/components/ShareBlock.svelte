<script lang="ts">
    import { shareFaceImage } from '$lib/images/cardImages.js'
    import { PreviewKind } from '$lib/model/cardPreview.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { ShareBlockView } from '$lib/model/turnPanel.js'

    let { shares }: { shares: ShareBlockView } = $props()

    const gameSession = getGameSession()
</script>

<!-- R-2.2, R-2.2-H1, R-2.2-H2: two trades, before the first placement or after the last. -->
<section class="pp-block min-w-0 flex-1">
    <div class="pp-block-heading">{shares.heading}</div>
    {#if shares.lockedNote}
        <p class="text-xs text-pp-muted">{shares.lockedNote}</p>
    {/if}
    <div class="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2.5 xl:grid-cols-4">
        {#each shares.entries as share (share.railroadId)}
            {@const face = shareFaceImage(share.railroadId)}
            <div class="flex items-center gap-2" class:dimmed={shares.lockedNote !== undefined}>
                <!-- Contract, "The principle": a press on a share face enlarges it and does nothing else. -->
                <button
                    type="button"
                    class="shrink-0"
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
                <div class="min-w-0 text-xs leading-tight text-pp-muted">
                    <div class="text-[13px] font-semibold text-pp-text">{share.name}</div>
                    <span class="pp-price">${share.price}</span>
                    · {share.deckCount} left · you hold {share.held}
                    <div class="mt-1 flex flex-wrap gap-1.5">
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
                        <div class="mt-0.5 text-[11px]">{share.buyReason}</div>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</section>

<style>
    .pp-price {
        font-family: Oswald, sans-serif;
        font-size: 18px;
        color: var(--pp-text);
    }

    .dimmed {
        opacity: 0.5;
    }
</style>
