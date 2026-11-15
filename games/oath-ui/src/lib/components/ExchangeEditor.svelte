<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        CardKind,
        PROMISE_MAX_LENGTH,
        type ExchangeAllowance,
        type ExchangeTransfer
    } from '@tabletop/oath'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import MenuToggleRow from '$lib/components/MenuToggleRow.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { warbandFigure } from '$lib/images/pieceImages.js'
    import { favorToken, secretToken } from '$lib/images/tileImages.js'
    import { cardChoices } from '$lib/model/cardChoice.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { chipCased, siteName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        exchangeOffers,
        inReturnOf,
        isSitePicked,
        promiseDraftOf,
        promiseLength,
        siteCounts,
        siteWarbandsIn,
        tappedCount,
        tappedSiteCount,
        toggled,
        transferOf,
        warbandsToMoveIn,
        withOfferedPicks,
        withPromise,
        withSiteCount,
        withSitePicked,
        withTransfer,
        type ExchangeOffers,
        type ExchangePicks,
        type ExchangeSide,
        type SiteOffer
    } from '$lib/model/exchangeTerms.js'

    // R-7.6.3, R-10.8 — the terms of a binding exchange, both ways. Each row lists only what the
    // engine accepts of it; the engine judges the whole terms on proposal and acceptance.
    let {
        proposerId,
        counterpartyId,
        allows,
        value,
        onchange
    }: {
        proposerId: string
        counterpartyId: string
        allows: ExchangeAllowance
        value: ExchangePicks
        onchange: (picks: ExchangePicks) => void
    } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let gameState = $derived(gameSession.gameState)
    let myId = $derived(gameSession.myPlayer?.id)

    type Column = {
        key: ExchangeSide
        giver: string
        receiver: string
        // R-10.8 — what the receiver gives back in the same exchange, sites picked but not yet counted too.
        inReturn: ExchangeTransfer
        offers: ExchangeOffers
    }

    let columns: Column[] = $derived(
        (
            [
                {
                    key: 'fromProposer',
                    giver: proposerId,
                    receiver: counterpartyId,
                    back: 'fromCounterparty'
                },
                {
                    key: 'fromCounterparty',
                    giver: counterpartyId,
                    receiver: proposerId,
                    back: 'fromProposer'
                }
            ] as const
        ).map(({ key, giver, receiver, back }) => {
            const inReturn = inReturnOf(gameState, value, back, receiver)
            return {
                key,
                giver,
                receiver,
                inReturn,
                offers: exchangeOffers(gameState, giver, receiver, allows, myId, inReturn)
            }
        })
    )

    const widths: Record<ExchangeSide, ChoiceWidth> = {
        fromProposer: new ChoiceWidth(),
        fromCounterparty: new ChoiceWidth()
    }

    function nameOf(playerId: string): string {
        return gameSession.getPlayerName(playerId)
    }

    function siteImage(site: SiteOffer): string {
        return (site.cardId ? cardImage(site.cardId) : undefined) ?? cardBack(CardKind.Site)
    }

    // R-10.8 — a pick the other side's change no longer allows leaves with it: no row would show it.
    function change(picks: ExchangePicks) {
        onchange(withOfferedPicks(gameState, proposerId, counterpartyId, allows, myId, picks))
    }

    function tapToken(key: ExchangeSide, token: 'favor' | 'secrets', tapped: number) {
        const picked = transferOf(value.terms, key)[token] ?? 0
        change({
            ...value,
            terms: withTransfer(value.terms, key, { [token]: tappedCount(picked, tapped) })
        })
    }

    // R-7.6.3-H1 — a promise moves nothing, so no row's offers change with it.
    function typePromise(key: ExchangeSide, text: string) {
        onchange(withPromise(value, key, text))
    }

    function toggleRelic(key: ExchangeSide, relicId: string) {
        const picked = transferOf(value.terms, key).relicCardIds
        const relicCardIds = toggled(picked, relicId, !picked?.includes(relicId))
        change({ ...value, terms: withTransfer(value.terms, key, { relicCardIds }) })
    }

    function toggleAdviser(key: ExchangeSide, row: number) {
        const picked = transferOf(value.terms, key).adviserRows
        const adviserRows = toggled(picked, row, !picked?.includes(row))
        change({ ...value, terms: withTransfer(value.terms, key, { adviserRows }) })
    }
</script>

<div class="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
    {#each columns as { key, giver, receiver, inReturn, offers } (key)}
        {@const transfer = transferOf(value.terms, key)}
        {@const moving = warbandsToMoveIn(gameState, receiver, inReturn.sites)}
        <div class="min-w-0 border-t border-oath-divider pt-1.5">
            <div class="text-oath-text-muted mb-1">
                {#if giver === myId}You give{:else}<PlayerName playerId={giver} /> gives{/if}
            </div>
            <div class="flex flex-col items-start gap-1.5">
                {#if offers.favor.held > 0}
                    <TokenRow
                        image={favorToken()}
                        {...offers.favor}
                        picked={transfer.favor ?? 0}
                        label={(n) => `${nameOf(giver)} gives ${n} favor`}
                        ontap={(n) => tapToken(key, 'favor', n)}
                        {busy}
                    />
                {/if}
                {#if offers.secrets.held > 0}
                    <TokenRow
                        image={secretToken()}
                        {...offers.secrets}
                        picked={transfer.secrets ?? 0}
                        label={(n) =>
                            `${nameOf(giver)} gives ${n} ${n === 1 ? 'secret' : 'secrets'}`}
                        ontap={(n) => tapToken(key, 'secrets', n)}
                        {busy}
                    />
                {/if}
                {#if offers.relicIds.length > 0}
                    <CardChoiceRow
                        choices={cardChoices(offers.relicIds)}
                        picked={transfer.relicCardIds ?? []}
                        onpick={(relicId) => toggleRelic(key, relicId)}
                        {busy}
                        height={60}
                    />
                {/if}
                {#each offers.sites as site (site.siteId)}
                    {@const picked = isSitePicked(value, key, site.siteId)}
                    {@const counts = siteCounts(
                        gameState,
                        giver,
                        receiver,
                        transfer,
                        site.siteId,
                        inReturn
                    )}
                    <MenuToggleRow
                        image={siteImage(site)}
                        name={siteName(gameState, site.siteId)}
                        on={picked}
                        disabled={busy}
                        width={widths[key]}
                        onclick={() =>
                            change(withSitePicked(value, key, site.siteId, counts, !picked))}
                    />
                    {#if picked && moving.owner !== undefined && moving.held > 0}
                        {@const count = siteWarbandsIn(transfer, site.siteId)}
                        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 pl-2">
                            <span>
                                {#if receiver === myId}You move in{:else}<PlayerName
                                        playerId={receiver}
                                    /> moves in{/if}
                            </span>
                            <TokenRow
                                image={warbandFigure(gameSession.warbandColor(moving.owner))}
                                held={moving.held}
                                addable={Math.max(0, ...counts)}
                                picked={count ?? 0}
                                label={(n) => `${nameOf(receiver)} moves ${n} in from their board`}
                                ontap={(n) =>
                                    change(
                                        withSiteCount(
                                            value,
                                            key,
                                            site.siteId,
                                            tappedSiteCount(counts, count, n)
                                        )
                                    )}
                                {busy}
                            />
                        </div>
                    {/if}
                {/each}
                {#if offers.advisers.length > 0}
                    <!-- R-9.4 — another player's facedown adviser is a back, offered by its row. -->
                    <CardChoiceRow
                        choices={offers.advisers.map((adviser) =>
                            adviser.cardId === undefined
                                ? {
                                      key: String(adviser.row),
                                      back: adviser.back,
                                      label: adviser.label
                                  }
                                : {
                                      key: String(adviser.row),
                                      cardId: adviser.cardId,
                                      label: adviser.label
                                  }
                        )}
                        picked={(transfer.adviserRows ?? []).map(String)}
                        onpick={(row) => toggleAdviser(key, Number(row))}
                        {busy}
                        height={60}
                    />
                {/if}
            </div>
            {#if allows.promises}
                <!-- R-7.6.3-H1 — this side's promise, optional; the counter is the engine's own count of it. -->
                <div class="mt-2 max-w-[330px]">
                    <label class="block">
                        <span class="text-oath-text-muted mb-[3px] block">
                            {giver === myId
                                ? 'You promise'
                                : `${chipCased(nameOf(giver))} promises`} (optional)
                        </span>
                        <textarea
                            class="field-sizing-content block min-h-11 w-full resize-none rounded-md border border-oath-frame bg-white/[.03] px-2 py-1.5 text-[13px] leading-[1.35] text-oath-text"
                            rows="1"
                            value={promiseDraftOf(value, key)}
                            disabled={busy}
                            oninput={(event) => typePromise(key, event.currentTarget.value)}
                        ></textarea>
                    </label>
                    <p class="text-right text-[11px] text-oath-text-muted" data-promise-count>
                        {promiseLength(value.terms, key)} / {PROMISE_MAX_LENGTH}
                    </p>
                </div>
            {/if}
        </div>
    {/each}
</div>
