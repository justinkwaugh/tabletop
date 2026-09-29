<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CardKind } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardChoices } from '$lib/model/cardChoice.js'
    import { bannerName, cardName, reliquaryLabel } from '$lib/model/names.js'

    // R-6.6.1, R-9.6 — the offer hands the turn to the Exile, and its terms bind.
    let gameSession = getGameSession()
    let me = $derived(gameSession.myPlayer)
    let offer = $derived(gameSession.citizenship)
    let busy = $derived(gameSession.busy)

    let exilePlayerId = $derived(offer.exilePlayerId)
    let reliquarySlotId = $derived(offer.reliquarySlotId)
</script>

<div class="rounded-lg bg-stone-900/70 border border-amber-500/40 px-3 py-2 text-stone-100">
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">Offer Citizenship</h3>

    {#if !exilePlayerId}
        <p class="text-sm mb-1">Choose an Exile. They will be asked, and may refuse.</p>
        <div class="flex flex-col gap-1">
            {#each offer.exiles as playerId (playerId)}
                <button
                    disabled={busy}
                    class="rounded border border-amber-500/40 bg-stone-800/60
                           hover:border-amber-300 px-2 py-1 text-sm text-left"
                    onclick={() => offer.chooseExile(playerId)}
                >
                    {gameSession.getPlayerName(playerId)}{playerId === me?.id ? ' (yourself)' : ''}
                </button>
            {/each}
        </div>
    {:else if !reliquarySlotId}
        <p class="text-sm mb-1">
            Promise exactly one relic from the Reliquary. It is facedown — you are promising the
            space, not a card you have seen.
        </p>
        <!-- R-6.4-H1 — a face to the Scepter's holder, who knows every one; a back to anyone else. -->
        <CardChoiceRow
            choices={offer.spaces.map((space) => {
                const known = gameSession.knownRelicAt(space.slotId)
                return known
                    ? { key: space.slotId, cardId: known, label: cardName(known) }
                    : {
                          key: space.slotId,
                          backKind: CardKind.Relic,
                          label: `Facedown relic on ${reliquaryLabel(space.slotId)}`
                      }
            })}
            picked={[]}
            onpick={(slotId) => offer.chooseReliquarySlot(slotId)}
            {busy}
            height={80}
        />
    {:else}
        {@const held = offer.holdings}
        <p class="text-sm mb-2">
            Offering <span class="font-semibold">{gameSession.getPlayerName(exilePlayerId)}</span>
            Citizenship, with the relic in {reliquarySlotId}.
        </p>

        <div class="mb-2 grid grid-cols-2 gap-2 text-xs">
            <div class="rounded border border-stone-700 px-2 py-1.5">
                <div class="text-stone-400 mb-1">You also give</div>
                <label class="block mb-1">
                    Favor {offer.offerTerms.givenFavor} of {held.offerer.favor}
                    <input
                        disabled={busy}
                        type="range"
                        min="0"
                        max={held.offerer.favor}
                        value={offer.offerTerms.givenFavor}
                        oninput={(e) => offer.setTerm('givenFavor', Number(e.currentTarget.value))}
                        class="w-full"
                    />
                </label>
                <label class="block">
                    Secrets {offer.offerTerms.givenSecrets} of {held.offerer.secrets}
                    <input
                        disabled={busy}
                        type="range"
                        min="0"
                        max={held.offerer.secrets}
                        value={offer.offerTerms.givenSecrets}
                        oninput={(e) =>
                            offer.setTerm('givenSecrets', Number(e.currentTarget.value))}
                        class="w-full"
                    />
                </label>
                {#if held.offerer.relicIds.length > 0}
                    <div class="my-1">
                        <CardChoiceRow
                            choices={cardChoices(held.offerer.relicIds)}
                            picked={offer.offerTerms.givenRelics}
                            onpick={(relicId) =>
                                offer.toggleRelic(
                                    'givenRelics',
                                    relicId,
                                    !offer.offerTerms.givenRelics.includes(relicId)
                                )}
                            {busy}
                            height={60}
                        />
                    </div>
                {/if}
                {#each held.offerer.banners as banner (banner)}
                    <label class="flex items-center gap-1">
                        <input
                            disabled={busy}
                            type="checkbox"
                            checked={offer.offerTerms.givenBanners.includes(banner)}
                            onchange={(e) =>
                                offer.toggleBanner('givenBanners', banner, e.currentTarget.checked)}
                        />
                        the {bannerName(banner)}
                    </label>
                {/each}
            </div>
            <div class="rounded border border-stone-700 px-2 py-1.5">
                <div class="text-stone-400 mb-1">They give</div>
                <label class="block mb-1">
                    Favor {offer.offerTerms.askedFavor} of {held.exile.favor}
                    <input
                        disabled={busy}
                        type="range"
                        min="0"
                        max={held.exile.favor}
                        value={offer.offerTerms.askedFavor}
                        oninput={(e) => offer.setTerm('askedFavor', Number(e.currentTarget.value))}
                        class="w-full"
                    />
                </label>
                <label class="block">
                    Secrets {offer.offerTerms.askedSecrets} of {held.exile.secrets}
                    <input
                        disabled={busy}
                        type="range"
                        min="0"
                        max={held.exile.secrets}
                        value={offer.offerTerms.askedSecrets}
                        oninput={(e) =>
                            offer.setTerm('askedSecrets', Number(e.currentTarget.value))}
                        class="w-full"
                    />
                </label>
                {#if held.exile.relicIds.length > 0}
                    <div class="my-1">
                        <CardChoiceRow
                            choices={cardChoices(held.exile.relicIds)}
                            picked={offer.offerTerms.askedRelics}
                            onpick={(relicId) =>
                                offer.toggleRelic(
                                    'askedRelics',
                                    relicId,
                                    !offer.offerTerms.askedRelics.includes(relicId)
                                )}
                            {busy}
                            height={60}
                        />
                    </div>
                {/if}
                {#each held.exile.banners as banner (banner)}
                    <label class="flex items-center gap-1">
                        <input
                            disabled={busy}
                            type="checkbox"
                            checked={offer.offerTerms.askedBanners.includes(banner)}
                            onchange={(e) =>
                                offer.toggleBanner('askedBanners', banner, e.currentTarget.checked)}
                        />
                        the {bannerName(banner)}
                    </label>
                {/each}
            </div>
        </div>

        {#if offer.blockedBecause}
            <p class="mb-2 text-[11px] text-rose-300">{offer.blockedBecause}</p>
        {/if}

        <div class="flex gap-2">
            <button
                class="grow rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40
                       px-2 py-1.5 text-sm font-semibold"
                disabled={busy || !!offer.blockedBecause}
                onclick={() => offer.offer()}
            >
                Put the offer to {gameSession.getPlayerName(exilePlayerId)}
            </button>
            <button
                disabled={busy}
                class="rounded bg-stone-700 hover:bg-stone-600 px-2 py-1.5 text-sm"
                onclick={() => gameSession.back()}
            >
                Back
            </button>
        </div>
    {/if}
</div>
