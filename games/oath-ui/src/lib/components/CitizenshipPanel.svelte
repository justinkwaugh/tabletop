<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import { range } from '@tabletop/common'
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

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">Offer Citizenship</h3>

    {#if !exilePlayerId}
        <p class="text-sm mb-1">Choose an Exile. They will be asked, and may refuse.</p>
        <div class="flex flex-col gap-1">
            {#each offer.exiles as playerId (playerId)}
                <button
                    disabled={busy}
                    class="rounded border border-oath-frame bg-oath-surface-raised
                           hover:border-oath-accent px-2 py-1 text-sm text-left"
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
                          back: CardKind.Relic,
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
            <div class="border-t border-oath-divider pt-1.5">
                <div class="text-oath-text-muted mb-1">You also give</div>
                <div class="mb-1">
                    <div class="mb-0.5">
                        <TokenText text="favor" />
                        <span class="text-oath-text-muted">you hold {held.offerer.favor}</span>
                    </div>
                    <CountPicker
                        values={range(0, held.offerer.favor + 1)}
                        picked={offer.offerTerms.givenFavor}
                        label={(n) => `you give ${n} favor`}
                        onpick={(n) => offer.setTerm('givenFavor', n)}
                        disabled={busy}
                    />
                </div>
                <div class="mb-1">
                    <div class="mb-0.5">
                        <TokenText text="secrets" />
                        <span class="text-oath-text-muted">you hold {held.offerer.secrets}</span>
                    </div>
                    <CountPicker
                        values={range(0, held.offerer.secrets + 1)}
                        picked={offer.offerTerms.givenSecrets}
                        label={(n) => `you give ${n} secrets`}
                        onpick={(n) => offer.setTerm('givenSecrets', n)}
                        disabled={busy}
                    />
                </div>
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
            <div class="border-t border-oath-divider pt-1.5">
                <div class="text-oath-text-muted mb-1">They give</div>
                <div class="mb-1">
                    <div class="mb-0.5">
                        <TokenText text="favor" />
                        <span class="text-oath-text-muted">they hold {held.exile.favor}</span>
                    </div>
                    <CountPicker
                        values={range(0, held.exile.favor + 1)}
                        picked={offer.offerTerms.askedFavor}
                        label={(n) => `they give ${n} favor`}
                        onpick={(n) => offer.setTerm('askedFavor', n)}
                        disabled={busy}
                    />
                </div>
                <div class="mb-1">
                    <div class="mb-0.5">
                        <TokenText text="secrets" />
                        <span class="text-oath-text-muted">they hold {held.exile.secrets}</span>
                    </div>
                    <CountPicker
                        values={range(0, held.exile.secrets + 1)}
                        picked={offer.offerTerms.askedSecrets}
                        label={(n) => `they give ${n} secrets`}
                        onpick={(n) => offer.setTerm('askedSecrets', n)}
                        disabled={busy}
                    />
                </div>
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
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(offer.blockedBecause) ?? ''} />
            </p>
        {/if}

        <div class="flex gap-2">
            <button
                class="grow rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                       border-[1.5px] border-oath-primary-border px-2 py-1.5 text-sm font-semibold"
                disabled={busy || !!offer.blockedBecause}
                onclick={() => offer.offer()}
            >
                Put the offer to {gameSession.getPlayerName(exilePlayerId)}
            </button>
        </div>
    {/if}
</div>
