<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import TokenText from '$lib/components/TokenText.svelte'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import { range } from '@tabletop/common'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import { cardChoices } from '$lib/model/cardChoice.js'
    import { siteName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { offerableAdviserRows } from '$lib/model/questionChoices.js'
    import {
        siteWarbandsIn,
        toggled,
        transferOf,
        withSiteWarbands,
        withTransfer,
        type ExchangeSide
    } from '$lib/model/exchangeTerms.js'
    import {
        sitesRuledBy,
        usableFavor,
        type ExchangeAllowance,
        type ExchangeTerms,
        type ExchangeTransfer,
        warbandsOnBoardOf
    } from '@tabletop/oath'

    // R-7.6.3, R-10.8 — the terms of a binding exchange, both ways. `allows`
    // says what the card's text admits; the engine re-validates on proposal and acceptance.
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
        value: ExchangeTerms
        onchange: (terms: ExchangeTerms) => void
    } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let gameState = $derived(gameSession.gameState)
    let myId = $derived(gameSession.myPlayer?.id)

    function side(key: ExchangeSide): ExchangeTransfer {
        return transferOf(value, key)
    }

    function set(key: ExchangeSide, patch: Partial<ExchangeTransfer>) {
        onchange(withTransfer(value, key, patch))
    }

    const sides = $derived([
        { key: 'fromProposer' as const, giver: proposerId, receiver: counterpartyId },
        { key: 'fromCounterparty' as const, giver: counterpartyId, receiver: proposerId }
    ])
</script>

<div class="grid grid-cols-2 gap-2 text-xs">
    {#each sides as { key, giver, receiver } (key)}
        {@const player = gameState.getPlayerState(giver)}
        {@const favor = usableFavor(gameState, giver)}
        <div class="border-t border-oath-divider pt-1.5">
            <div class="text-oath-text-muted mb-1">
                {#if giver === myId}You give{:else}<PlayerName playerId={giver} /> gives{/if}
            </div>
            <div class="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="w-14"><TokenText text="favor" /></span>
                <CountPicker
                    values={range(0, favor + 1)}
                    picked={side(key).favor ?? 0}
                    label={(n) => `${gameSession.getPlayerName(giver)} gives ${n} favor`}
                    onpick={(n) => set(key, { favor: n })}
                    disabled={busy}
                />
            </div>
            <div class="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="w-14"><TokenText text="secrets" /></span>
                <CountPicker
                    values={range(0, player.secrets + 1)}
                    picked={side(key).secrets ?? 0}
                    label={(n) =>
                        `${gameSession.getPlayerName(giver)} gives ${n} ${n === 1 ? 'secret' : 'secrets'}`}
                    onpick={(n) => set(key, { secrets: n })}
                    disabled={busy}
                />
            </div>
            {#if allows.relics && player.relicIds.length > 0}
                <div class="mb-1">
                    <CardChoiceRow
                        choices={cardChoices(player.relicIds)}
                        picked={side(key).relicCardIds ?? []}
                        onpick={(relicId) =>
                            set(key, {
                                relicCardIds: toggled(
                                    side(key).relicCardIds,
                                    relicId,
                                    !(side(key).relicCardIds ?? []).includes(relicId)
                                )
                            })}
                        {busy}
                        height={60}
                    />
                </div>
            {/if}
            {#if allows.sites}
                {#each sitesRuledBy(gameState, giver) as siteId (siteId)}
                    {@const on = siteWarbandsIn(side(key), siteId) !== undefined}
                    <label class="flex items-center gap-2">
                        <input
                            disabled={busy}
                            type="checkbox"
                            checked={on}
                            onchange={(e) =>
                                set(
                                    key,
                                    withSiteWarbands(
                                        side(key),
                                        siteId,
                                        e.currentTarget.checked ? 1 : undefined
                                    )
                                )}
                        />
                        {siteName(gameState, siteId)}
                    </label>
                    {#if on}
                        <div class="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-5">
                            <span>
                                {#if receiver === myId}You move in{:else}<PlayerName
                                        playerId={receiver}
                                    /> moves in{/if}
                            </span>
                            <CountPicker
                                values={range(1, warbandsOnBoardOf(gameState, receiver))}
                                picked={siteWarbandsIn(side(key), siteId)}
                                label={(n) =>
                                    `${gameSession.getPlayerName(receiver)} moves ${n} in from their board`}
                                onpick={(n) => set(key, withSiteWarbands(side(key), siteId, n))}
                                disabled={busy}
                            />
                        </div>
                    {/if}
                {/each}
            {/if}
            {#if allows.advisers}
                {@const rows = offerableAdviserRows(gameState, giver, gameSession.myPlayer?.id)}
                <!-- R-9.4 — another player's facedown adviser is a back, offered by its row. -->
                <CardChoiceRow
                    choices={rows.map((adviser) =>
                        adviser.cardId === undefined
                            ? { key: String(adviser.row), back: adviser.back, label: adviser.label }
                            : {
                                  key: String(adviser.row),
                                  cardId: adviser.cardId,
                                  label: adviser.label
                              }
                    )}
                    picked={(side(key).adviserRows ?? []).map(String)}
                    onpick={(row) =>
                        set(key, {
                            adviserRows: toggled(
                                side(key).adviserRows,
                                Number(row),
                                !(side(key).adviserRows ?? []).includes(Number(row))
                            )
                        })}
                    {busy}
                    height={60}
                />
            {/if}
        </div>
    {/each}
</div>
