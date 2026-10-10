<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import TokenText from '$lib/components/TokenText.svelte'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import BannerPick from '$lib/components/BannerPick.svelte'
    import CardImage from '$lib/components/CardImage.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import { range } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { Banner } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import { cardChoices, reliquaryRelicChoice, type CardChoice } from '$lib/model/cardChoice.js'

    // R-6.6.1, R-9.6 — the offer hands the turn to the Exile, and its terms bind. Undo backs out
    // of it one pick at a time: a term, the relic, the Exile, then the action.
    let gameSession = getGameSession()
    let offer = $derived(gameSession.citizenship)
    let busy = $derived(gameSession.busy)

    let exilePlayerId = $derived(offer.exilePlayerId)
    let reliquarySlotId = $derived(offer.reliquarySlotId)

    // As tall as the relic card on the Exile's answer.
    const CARD_HEIGHT = 56

    // R-6.4-H1 — a face to the Scepter's holder, who knows every Reliquary relic; a back to anyone else.
    function relicAt(slotId: string): CardChoice {
        return reliquaryRelicChoice(slotId, (slot) => gameSession.knownRelicAt(slot))
    }

    function toggleBanner(term: 'givenBanners' | 'askedBanners', banner: Banner) {
        offer.toggleBanner(term, banner, !offer.offerTerms[term].includes(banner))
    }
</script>

{#snippet countRow(
    token: string,
    held: number,
    picked: number,
    gives: boolean,
    label: (n: number) => string,
    onpick: (n: number) => void
)}
    <div class="flex flex-wrap items-center gap-2">
        <span class="w-6"><TokenText text={token} /></span>
        <CountPicker values={range(0, held + 1)} {picked} {label} {onpick} {gives} disabled={busy} />
    </div>
{/snippet}

{#snippet bannerTiles(
    banners: Banner[],
    picked: Banner[],
    term: 'givenBanners' | 'askedBanners'
)}
    {#if banners.length > 0}
        <div class="flex flex-wrap gap-x-4 gap-y-3.5 max-sm:flex-col max-sm:items-start">
            {#each banners as banner (banner)}
                <BannerPick
                    {banner}
                    picked={picked.includes(banner)}
                    onpick={() => toggleBanner(term, banner)}
                    {busy}
                    height={CARD_HEIGHT}
                />
            {/each}
        </div>
    {/if}
{/snippet}

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">Offer Citizenship</h3>

    {#if !exilePlayerId}
        <div class="mb-1 flex flex-wrap items-center gap-2 text-sm">
            <span class="text-oath-text-muted">To:</span>
            {#each offer.exiles as playerId (playerId)}
                <button
                    type="button"
                    class="rounded p-0.5 ring-1 ring-transparent hover:ring-oath-accent max-sm:min-h-11"
                    disabled={busy}
                    onclick={() => offer.chooseExile(playerId)}
                >
                    <PlayerName {playerId} />
                </button>
            {/each}
        </div>
    {:else if !reliquarySlotId}
        <p class="text-sm mb-1">Promise <PlayerName playerId={exilePlayerId} /> one relic.</p>
        <CardChoiceRow
            choices={offer.spaces.map((space) => relicAt(space.slotId))}
            picked={[]}
            onpick={(slotId) => offer.chooseReliquarySlot(slotId)}
            {busy}
            height={80}
        />
    {:else}
        {@const held = offer.holdings}
        {@const terms = offer.offerTerms}
        {@const promised = relicAt(reliquarySlotId)}
        <p class="text-sm mb-2">To <PlayerName playerId={exilePlayerId} /></p>

        <!-- The Exile's answer reads these rows from the other side. -->
        <div
            class="mb-2 grid grid-cols-[74px_minmax(0,1fr)] items-start gap-x-2 gap-y-2.5 border-t
                   border-oath-divider pt-2 text-[13px]"
        >
            <span class="pt-2 text-xs text-oath-text-muted">You give</span>
            <div class="flex flex-col gap-1.5">
                <span class="relative inline-flex self-start">
                    <CardImage
                        cardId={promised.cardId}
                        back={promised.back}
                        label={promised.label}
                        width={widthAtHeight(CARD_HEIGHT, promised)}
                    />
                    <Magnifier preview={promised} label={promised.label} />
                </span>
                {#if held.offerer.relicIds.length > 0}
                    <CardChoiceRow
                        choices={cardChoices(held.offerer.relicIds)}
                        picked={terms.givenRelics}
                        onpick={(relicId) =>
                            offer.toggleRelic(
                                'givenRelics',
                                relicId,
                                !terms.givenRelics.includes(relicId)
                            )}
                        {busy}
                        height={CARD_HEIGHT}
                    />
                {/if}
                {@render bannerTiles(held.offerer.banners, terms.givenBanners, 'givenBanners')}
                {@render countRow(
                    'favor',
                    held.offerer.favor,
                    terms.givenFavor,
                    true,
                    (n) => `you give ${n} favor`,
                    (n) => offer.setTerm('givenFavor', n)
                )}
                {@render countRow(
                    'secrets',
                    held.offerer.secrets,
                    terms.givenSecrets,
                    true,
                    (n) => `you give ${n} secrets`,
                    (n) => offer.setTerm('givenSecrets', n)
                )}
            </div>

            <span class="pt-2 text-xs text-oath-text-muted">You get</span>
            <div class="flex flex-col gap-1.5">
                {#if held.exile.relicIds.length > 0}
                    <CardChoiceRow
                        choices={cardChoices(held.exile.relicIds)}
                        picked={terms.askedRelics}
                        onpick={(relicId) =>
                            offer.toggleRelic(
                                'askedRelics',
                                relicId,
                                !terms.askedRelics.includes(relicId)
                            )}
                        {busy}
                        height={CARD_HEIGHT}
                    />
                {/if}
                {@render bannerTiles(held.exile.banners, terms.askedBanners, 'askedBanners')}
                {@render countRow(
                    'favor',
                    held.exile.favor,
                    terms.askedFavor,
                    false,
                    (n) => `they give ${n} favor`,
                    (n) => offer.setTerm('askedFavor', n)
                )}
                {@render countRow(
                    'secrets',
                    held.exile.secrets,
                    terms.askedSecrets,
                    false,
                    (n) => `they give ${n} secrets`,
                    (n) => offer.setTerm('askedSecrets', n)
                )}
            </div>
        </div>

        <!-- Rule 1 — terms the engine refuses have no Offer; its reason is the one red line. -->
        {#if offer.blockedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(offer.blockedBecause) ?? ''} />
            </p>
        {:else}
            <button
                type="button"
                class="rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                       border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
                disabled={busy}
                onclick={() => offer.offer()}
            >
                Offer
            </button>
        {/if}
    {/if}
</div>
