<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import TokenText from '$lib/components/TokenText.svelte'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import TermTile from '$lib/components/TermTile.svelte'
    import CardImage from '$lib/components/CardImage.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { widthAtHeight } from '$lib/images/cardShape.js'
    import { cardImage } from '$lib/images/cardImages.js'
    import { bannerPreview } from '$lib/model/bannerPreview.js'
    import { cardName } from '$lib/model/names.js'
    import { reliquaryRelicChoice, type CardChoice } from '$lib/model/cardChoice.js'

    // R-6.6.1, R-9.6 — the offer hands the turn to the Exile, and its terms bind. Undo backs out
    // of it one pick at a time: a term, the relic, the Exile, then the action.
    let gameSession = getGameSession()
    let offer = $derived(gameSession.citizenship)
    let busy = $derived(gameSession.busy)
    let gameState = $derived(gameSession.gameState)

    let exilePlayerId = $derived(offer.exilePlayerId)
    let reliquarySlotId = $derived(offer.reliquarySlotId)

    // The promised relic: as tall as the relic card on the Exile's answer.
    const CARD_HEIGHT = 56

    type Side = 'offerer' | 'exile'
    type SideTerms = {
        relics: 'givenRelics' | 'askedRelics'
        banners: 'givenBanners' | 'askedBanners'
        favor: 'givenFavor' | 'askedFavor'
        secrets: 'givenSecrets' | 'askedSecrets'
        giver: string
    }
    const SIDES: Record<Side, SideTerms> = {
        offerer: {
            relics: 'givenRelics',
            banners: 'givenBanners',
            favor: 'givenFavor',
            secrets: 'givenSecrets',
            giver: 'you'
        },
        exile: {
            relics: 'askedRelics',
            banners: 'askedBanners',
            favor: 'askedFavor',
            secrets: 'askedSecrets',
            giver: 'they'
        }
    }

    // R-6.4-H1 — a face to the Scepter's holder, who knows every Reliquary relic; a back to anyone else.
    function relicAt(slotId: string): CardChoice {
        return reliquaryRelicChoice(slotId, (slot) => gameSession.knownRelicAt(slot))
    }
</script>

<!-- One side's relics and banners as small tiles, then its favor and secrets as token rows; a
     token the side holds none of has no row. -->
{#snippet sideTerms(side: Side)}
    {@const held = offer.holdings[side]}
    {@const terms = SIDES[side]}
    {@const favor = offer.tokenRow(terms.favor)}
    {@const secrets = offer.tokenRow(terms.secrets)}
    {#each held.relicIds as relicId (relicId)}
        {@const picked = offer.offerTerms[terms.relics].includes(relicId)}
        <TermTile
            src={cardImage(relicId)}
            label={cardName(relicId)}
            preview={{ cardId: relicId, label: cardName(relicId) }}
            {picked}
            onpick={() => offer.toggleRelic(terms.relics, relicId, !picked)}
            {busy}
        />
    {/each}
    {#each held.banners as banner (banner)}
        {@const preview = bannerPreview(gameState, banner)}
        {@const picked = offer.offerTerms[terms.banners].includes(banner)}
        <TermTile
            src={preview.imageSrc}
            label={preview.label}
            {preview}
            wide
            {picked}
            onpick={() => offer.toggleBanner(terms.banners, banner, !picked)}
            {busy}
        />
    {/each}
    {#if favor.held > 0}
        <TokenRow
            token="favor"
            {...favor}
            label={(n) => `${terms.giver} give ${n} favor`}
            ontap={(n) => offer.tapToken(terms.favor, n)}
            {busy}
        />
    {/if}
    {#if secrets.held > 0}
        <TokenRow
            token="secrets"
            {...secrets}
            label={(n) => `${terms.giver} give ${n} ${n === 1 ? 'secret' : 'secrets'}`}
            ontap={(n) => offer.tapToken(terms.secrets, n)}
            {busy}
        />
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
        {@const promised = relicAt(reliquarySlotId)}
        <p class="text-sm mb-2">To <PlayerName playerId={exilePlayerId} /></p>

        <!-- The deal: the two sides side by side on a desktop, stacked on a phone; the Exile's
             answer reads it from the other side. An Exile offering himself gets no terms. -->
        <div
            class="mb-2.5 grid border-t border-oath-divider pt-2 {offer.offersSelf
                ? ''
                : 'sm:grid-cols-2'}"
        >
            <div class="min-w-0 sm:pr-6">
                <p class="mb-1.5 text-xs text-oath-text-muted">You give</p>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <!-- R-6.6.1 — the promised relic is the offer itself, not a pick: Undo changes it. -->
                    <span class="relative inline-flex flex-none">
                        <CardImage
                            cardId={promised.cardId}
                            back={promised.back}
                            label={promised.label}
                            width={widthAtHeight(CARD_HEIGHT, promised)}
                        />
                        <Magnifier preview={promised} label={promised.label} />
                    </span>
                    {#if !offer.offersSelf}
                        {@render sideTerms('offerer')}
                    {/if}
                </div>
            </div>
            {#if !offer.offersSelf}
                <div
                    class="min-w-0 border-oath-divider max-sm:mt-2 max-sm:border-t max-sm:pt-2 sm:border-l
                           sm:pl-6"
                >
                    <p class="mb-1.5 text-xs text-oath-text-muted">You get</p>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                        {@render sideTerms('exile')}
                    </div>
                </div>
            {/if}
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
