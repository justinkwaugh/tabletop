<script lang="ts">
    import { CardKind, type Banner, type RecoverCost } from '@tabletop/oath'
    import MenuChoice from '$lib/components/MenuChoice.svelte'
    import MenuCount from '$lib/components/MenuCount.svelte'
    import MenuRow from '$lib/components/MenuRow.svelte'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import type { SizedImage } from '$lib/images/manifestIndex.js'
    import { suitImage } from '$lib/images/suitImages.js'
    import { bannerImage, favorToken, secretToken } from '$lib/images/tileImages.js'
    import { bannerName, bannerTokenKind, cardName, siteName, suitName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.4 — the relics at the site at their printed price, then the banners at their least bid.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let rows = $derived(gameSession.recoverRows)
    let busy = $derived(gameSession.busy)
    let siteId = $derived(gameSession.myPlayerState?.siteId)
    let slots = $derived(siteId ? gameState.relicSlotsAt(siteId).map((slot) => slot.slotId) : [])

    function relicName(slotId: string): string {
        const known = gameSession.knownRelicAt(slotId)
        return known ? cardName(known) : `Facedown relic, space ${slots.indexOf(slotId) + 1}`
    }

    function relicImage(slotId: string): string {
        const known = gameSession.knownRelicAt(slotId)
        return (known ? cardImage(known) : undefined) ?? cardBack(CardKind.Relic)
    }

    function costWords(cost: RecoverCost): string {
        switch (cost.kind) {
            case 'placeFavorInBank':
                return `place ${cost.amount} favor in the ${suitName(cost.suit)} bank`
            case 'burnFavor':
                return `burn ${cost.amount} favor`
            case 'burnSecrets':
                return `burn ${cost.amount} ${cost.amount === 1 ? 'secret' : 'secrets'}`
        }
    }

    function tokenOf(banner: Banner): SizedImage {
        return bannerTokenKind(banner) === 'favor' ? favorToken() : secretToken()
    }
</script>

{#if rows.relics.length > 0 && siteId}
    <h3 class="mb-1 text-[11px] font-semibold uppercase tracking-widest text-oath-heading">
        Relics at {siteName(gameState, siteId)}
    </h3>
    <div class="mb-1.5 flex flex-col gap-1.5" role="list" aria-label="Relics to recover">
        {#each rows.relics as row (row.slotId)}
            <MenuRow
                image={relicImage(row.slotId)}
                imageAlt=""
                name={relicName(row.slotId)}
                shape="relic"
                points={{ kind: 'relic', slotId: row.slotId }}
            >
                <MenuChoice
                    label="Recover {relicName(row.slotId)}: {costWords(row.cost)}"
                    disabled={busy}
                    onclick={() => gameSession.chooseRelicSlot(row.slotId)}
                >
                    <span class="flex items-center gap-1.5 whitespace-nowrap text-oath-accent">
                        {#if row.cost.kind === 'placeFavorInBank'}
                            <MenuCount count={row.cost.amount} image={favorToken()} />
                            to
                            <img
                                class="h-5 w-5"
                                src={suitImage(row.cost.suit)}
                                alt={suitName(row.cost.suit)}
                            />
                        {:else}
                            burn
                            <MenuCount
                                count={row.cost.amount}
                                image={row.cost.kind === 'burnFavor' ? favorToken() : secretToken()}
                            />
                        {/if}
                    </span>
                </MenuChoice>
            </MenuRow>
        {/each}
    </div>
{/if}

{#if rows.banners.length > 0}
    <h3 class="mb-1 text-[11px] font-semibold uppercase tracking-widest text-oath-heading">
        Banners
    </h3>
    <div class="flex flex-col gap-1.5" role="list" aria-label="Banners to recover">
        {#each rows.banners as bid (bid.banner)}
            {@const least = bid.amounts[0] ?? 0}
            {@const more = bid.amounts.length > 1}
            <MenuRow
                image={bannerImage(bid.banner, gameState.isOnMobSide(bid.banner))}
                imageAlt=""
                name={bannerName(bid.banner)}
                shape="wide"
                points={{ kind: 'banner', banner: bid.banner }}
            >
                <MenuChoice
                    label="Recover the {bannerName(bid.banner)}: pay {least} {bannerTokenKind(
                        bid.banner
                    ) === 'favor'
                        ? 'favor'
                        : least === 1
                          ? 'secret'
                          : 'secrets'}{more ? ' or more' : ''}"
                    disabled={busy}
                    onclick={() => gameSession.pickBanner(bid.banner)}
                >
                    <span class="flex items-center gap-1.5 whitespace-nowrap">
                        <MenuCount count={least} image={tokenOf(bid.banner)} cost />
                        {#if more}<span class="text-sm font-normal">or more</span>{/if}
                    </span>
                </MenuChoice>
            </MenuRow>
        {/each}
    </div>
{/if}
