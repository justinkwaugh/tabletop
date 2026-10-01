<script lang="ts">
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
        <div class="border-t border-stone-700/60 pt-1.5">
            <div class="text-stone-400 mb-1">{gameSession.getPlayerName(giver)} gives</div>
            <label class="flex items-center gap-2 mb-1">
                <span class="w-14">favor</span>
                <input
                    disabled={busy}
                    type="number"
                    min="0"
                    max={favor}
                    class="w-16 rounded bg-stone-800 px-1 py-0.5"
                    value={side(key).favor ?? 0}
                    oninput={(e) =>
                        set(key, { favor: Math.max(0, Number(e.currentTarget.value) || 0) })}
                />
                <span class="text-stone-500">of {favor}</span>
            </label>
            <label class="flex items-center gap-2 mb-1">
                <span class="w-14">secrets</span>
                <input
                    disabled={busy}
                    type="number"
                    min="0"
                    max={player.secrets}
                    class="w-16 rounded bg-stone-800 px-1 py-0.5"
                    value={side(key).secrets ?? 0}
                    oninput={(e) =>
                        set(key, { secrets: Math.max(0, Number(e.currentTarget.value) || 0) })}
                />
                <span class="text-stone-500">of {player.secrets}</span>
            </label>
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
                        <label class="flex items-center gap-2 pl-5 mb-1">
                            <span>{gameSession.getPlayerName(receiver)} moves in</span>
                            <input
                                disabled={busy}
                                type="number"
                                min="1"
                                class="w-14 rounded bg-stone-800 px-1 py-0.5"
                                value={siteWarbandsIn(side(key), siteId)}
                                oninput={(e) =>
                                    set(
                                        key,
                                        withSiteWarbands(
                                            side(key),
                                            siteId,
                                            Math.max(1, Number(e.currentTarget.value) || 1)
                                        )
                                    )}
                            />
                            <span class="text-stone-500"
                                >of {warbandsOnBoardOf(gameState, receiver)} on board</span
                            >
                        </label>
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
