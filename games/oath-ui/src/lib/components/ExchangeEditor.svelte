<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { CardKind, type ExchangeAllowance } from '@tabletop/oath'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import MenuToggleRow from '$lib/components/MenuToggleRow.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { warbandFigure } from '$lib/images/pieceImages.js'
    import { favorToken, secretToken } from '$lib/images/tileImages.js'
    import { cardChoices } from '$lib/model/cardChoice.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { siteName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        exchangeOffers,
        isSitePicked,
        siteCounts,
        siteWarbandsIn,
        tappedCount,
        tappedSiteCount,
        toggled,
        transferOf,
        warbandsToMoveIn,
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

    type Column = { key: ExchangeSide; giver: string; receiver: string; offers: ExchangeOffers }

    let columns: Column[] = $derived(
        (
            [
                { key: 'fromProposer', giver: proposerId, receiver: counterpartyId },
                { key: 'fromCounterparty', giver: counterpartyId, receiver: proposerId }
            ] as const
        ).map((side) => ({
            ...side,
            offers: exchangeOffers(gameState, side.giver, side.receiver, allows, myId)
        }))
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

    function tapToken(key: ExchangeSide, token: 'favor' | 'secrets', tapped: number) {
        const picked = transferOf(value.terms, key)[token] ?? 0
        onchange({
            ...value,
            terms: withTransfer(value.terms, key, { [token]: tappedCount(picked, tapped) })
        })
    }

    function toggleRelic(key: ExchangeSide, relicId: string) {
        const picked = transferOf(value.terms, key).relicCardIds
        const relicCardIds = toggled(picked, relicId, !picked?.includes(relicId))
        onchange({ ...value, terms: withTransfer(value.terms, key, { relicCardIds }) })
    }

    function toggleAdviser(key: ExchangeSide, row: number) {
        const picked = transferOf(value.terms, key).adviserRows
        const adviserRows = toggled(picked, row, !picked?.includes(row))
        onchange({ ...value, terms: withTransfer(value.terms, key, { adviserRows }) })
    }
</script>

<div class="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
    {#each columns as { key, giver, receiver, offers } (key)}
        {@const transfer = transferOf(value.terms, key)}
        {@const moving = warbandsToMoveIn(gameState, receiver)}
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
                        site.siteId
                    )}
                    <MenuToggleRow
                        image={siteImage(site)}
                        name={siteName(gameState, site.siteId)}
                        on={picked}
                        disabled={busy}
                        width={widths[key]}
                        onclick={() =>
                            onchange(withSitePicked(value, key, site.siteId, counts, !picked))}
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
                                    onchange(
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
        </div>
    {/each}
</div>
