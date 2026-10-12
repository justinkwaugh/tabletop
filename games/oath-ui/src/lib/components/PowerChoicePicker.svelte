<script lang="ts">
    import {
        PowerChoiceKind,
        exchangeAllowanceOf,
        type LegalChoice,
        type PowerChoice,
        type WarbandOwner
    } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import { range } from '@tabletop/common'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import ExchangeEditor from '$lib/components/ExchangeEditor.svelte'
    import BargainPicker from '$lib/components/BargainPicker.svelte'
    import PlayerChips from '$lib/components/PlayerChips.svelte'
    import WarbandGroupRows from '$lib/components/WarbandGroupRows.svelte'
    import { noExchangePicks, type ExchangePicks } from '$lib/model/exchangeTerms.js'
    import { powerChoiceCards, type CardResolvers } from '$lib/model/cardChoice.js'
    import { adviserBack } from '$lib/model/cardBacks.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { PickerWords } from '$lib/model/powerPickerWords.js'
    import type { PowerSiteRow } from '$lib/model/powerSites.js'
    import {
        cardName,
        facedownAdviserLabel,
        reliquaryLabel,
        siteName,
        slotLabel,
        warbandOwnerName
    } from '$lib/model/names.js'
    import {
        allowsSeveral,
        emptyPicks,
        exchangePartners,
        favorBankSuits,
        gridAt,
        gridCeilingAt,
        gridCounts,
        NO_OPTION,
        openCountCeiling,
        optionIndexOf,
        playerOptions,
        warbandGrids,
        withCount,
        withGridCount,
        withOptionPick,
        type PowerChoicePicks,
        type WarbandGrid
    } from '$lib/model/powerChoices.js'

    let {
        choices,
        picks = $bindable(emptyPicks()),
        tallOnPhone = false,
        tollAt = () => false,
        words = { tone: 'gold' },
        siteOnMap = () => undefined
    }: {
        choices: LegalChoice[]
        picks?: PowerChoicePicks
        /** Its list is 44 px tall on a phone, as Use a power draws its pick beside its buttons. */
        tallOnPhone?: boolean
        tollAt?: (siteId: string) => boolean
        /** The power's own few words for its picks, and the ring its warbands take. */
        words?: PickerWords
        /** A site spec picked on the lit map (Use a power): its row, read from the panel's draft. */
        siteOnMap?: (spec: number) => PowerSiteRow | undefined
    } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)

    let countCeiling = $derived(openCountCeiling(gameSession.gameState, gameSession.myPlayer?.id))
    let grids = $derived(warbandGrids(choices))

    function relicSlotLabel(slotId: string): string {
        if (/^reliquary\./.test(slotId)) return reliquaryLabel(slotId)
        const state = gameSession.gameState
        const siteId = state.findRelicSlot(slotId)?.siteId
        const known = gameSession.knownRelicAt(slotId)
        return known
            ? cardName(known)
            : siteId
              ? `facedown relic at ${siteName(state, siteId)}`
              : slotId
    }

    const resolve: CardResolvers = {
        knownRelicAt: (slotId) => gameSession.knownRelicAt(slotId),
        faceupSiteCardAt: (siteId) =>
            gameSession.gameState.isSiteFaceup(siteId)
                ? gameSession.gameState.siteCardAt(siteId)
                : undefined,
        relicSlotLabel,
        facedownAdviserLabel: (playerId, index) =>
            facedownAdviserLabel(
                gameSession.gameState,
                gameSession.getPlayerName(playerId),
                playerId,
                index
            ),
        facedownAdviserBack: (playerId, index) =>
            adviserBack(gameSession.gameState.getPlayerState(playerId).advisers[index]),
        siteLabel: (siteId) => siteName(gameSession.gameState, siteId),
        warbandOwnerName: (owner) => ownerName(owner)
    }

    function ownerName(owner: WarbandOwner): string {
        return warbandOwnerName(owner, (playerId) => gameSession.getPlayerName(playerId))
    }

    // A facedown site is named as the board names it: the site back has no name to show.
    function mapSiteName(siteId: string): string {
        return gameSession.gameState.isSiteFaceup(siteId)
            ? siteName(gameSession.gameState, siteId)
            : `Facedown site — ${slotLabel(siteId)}`
    }

    // A pick of a card-drawn option: a tap on the picked card clears it when the choice is optional.
    function tapOption(legal: LegalChoice, i: number, pick: number, j: number) {
        if (j !== pick) setOption(legal, i, j)
        else if (legal.spec.min === 0) setOption(legal, i, NO_OPTION)
    }

    function label(option: PowerChoice): string {
        switch (option.kind) {
            case PowerChoiceKind.Yes:
                return 'yes'
            case PowerChoiceKind.FavorBank:
                return `${option.suit} bank`
            case PowerChoiceKind.Player:
                return gameSession.getPlayerName(option.playerId)
            case PowerChoiceKind.Card:
                return cardName(option.cardId)
            case PowerChoiceKind.Site:
                return (
                    siteName(gameSession.gameState, option.siteId) +
                    (tollAt(option.siteId) ? ' · toll 1 favor' : '')
                )
            case PowerChoiceKind.Warbands:
                return `${option.group.count} ${ownerName(option.group.owner)} at ${
                    option.group.at.kind === 'site'
                        ? siteName(gameSession.gameState, option.group.at.siteId)
                        : `${gameSession.getPlayerName(option.group.at.playerId)}'s board`
                }`
            case PowerChoiceKind.Region:
                return `the ${option.region}`
            case PowerChoiceKind.RelicSlot:
                return relicSlotLabel(option.slotId)
            case PowerChoiceKind.FacedownAdviser:
                return facedownAdviserLabel(
                    gameSession.gameState,
                    gameSession.getPlayerName(option.playerId),
                    option.playerId,
                    option.index
                )
            case PowerChoiceKind.Exchange:
                return gameSession.getPlayerName(option.withPlayerId)
            case PowerChoiceKind.Count:
                return `${option.n}`
            case PowerChoiceKind.Bargain:
                return gameSession.getPlayerName(option.playerId)
        }
    }

    function setOption(legal: LegalChoice, i: number, pick: number) {
        picks = withOptionPick(picks, legal, i, pick)
    }
    function setCount(i: number, count: number) {
        picks = withCount(picks, i, count)
    }
    function setTerms(i: number, value: ExchangePicks) {
        picks = { ...picks, terms: { ...picks.terms, [i]: value } }
    }
    function toggleSeveral(i: number, j: number, on: boolean) {
        const rest = (picks.several[i] ?? []).filter((picked) => picked !== j)
        picks = { ...picks, several: { ...picks.several, [i]: on ? [...rest, j] : rest } }
    }
    function setGridCount(grid: WarbandGrid, row: number, count: number) {
        picks = withGridCount(picks, grid, row, count)
    }
</script>

{#each choices as legal, i (i)}
    {@const pick = optionIndexOf(legal, i, picks)}
    {@const option = legal.options[pick]}
    {@const grid = gridAt(grids, i)}
    {@const onMap = words.site ? siteOnMap(i) : undefined}
    <!-- A grid draws every spec it answers once, at its first. -->
    {#if !grid || grid.specs[0] === i}
        <div class="mb-1 text-xs">
            {#if grid}
                {@const counts = gridCounts(grid, picks)}
                {@const heading =
                    words.warbands?.(grid.total) ?? `${legal.spec.what ?? 'warbands'}:`}
                {@const ownPlace = words.ownPlace === true && grid.groups.length === 1}
                {#if !ownPlace}
                    <div class="mb-1">{heading}</div>
                {/if}
                <!-- A spec taking several groups offers where they go (the Cage's boards). -->
                <WarbandGroupRows
                    lead={ownPlace ? heading : undefined}
                    groups={grid.groups}
                    {counts}
                    ceilingAt={(row) => gridCeilingAt(grid, counts, row)}
                    onpick={(row, n) => setGridCount(grid, row, n)}
                    tone={words.tone}
                    per={grid.step === 2 ? 2 : 1}
                    toward={grid.shared}
                    ownerWord={grid.namesOwners}
                />
            {:else if legal.spec.kind === PowerChoiceKind.Bargain}
                <BargainPicker
                    {legal}
                    picks={picks.bargain[i] ?? []}
                    onchange={(value) =>
                        (picks = { ...picks, bargain: { ...picks.bargain, [i]: value } })}
                />
            {:else if onMap && words.site}
                <!-- R-7.1.3 — the site is a tap on the lit map, once the picks before it are made. -->
                {#if onMap.ready}
                    <p class="flex flex-wrap items-baseline gap-x-1" data-site-row>
                        <span class="text-oath-text-muted">{words.site.row}</span>
                        {#if onMap.picked}
                            <span class="font-semibold"
                                >{mapSiteName(onMap.picked)}{tollAt(onMap.picked)
                                    ? ' · toll 1 favor'
                                    : ''}</span
                            >
                        {:else if onMap.sites.length > 0}
                            <span>tap a lit site.</span>
                        {/if}
                    </p>
                    {#if onMap.sites.length === 0 && legal.spec.min > 0}
                        <p class="text-oath-danger">no legal site right now</p>
                    {/if}
                {/if}
            {:else if legal.spec.kind === PowerChoiceKind.Count}
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span class="text-oath-text-muted">{legal.spec.what ?? 'how many'}:</span>
                    <CountPicker
                        values={range(0, countCeiling + 1)}
                        picked={picks.count[i] ?? 0}
                        label={(n) => `${legal.spec.what ?? 'how many'}: ${n}`}
                        onpick={(n) => setCount(i, n)}
                        disabled={busy}
                    />
                </div>
            {:else if legal.spec.kind === PowerChoiceKind.Exchange}
                {@const partners = exchangePartners(legal.options)}
                <PlayerChips
                    label="With:"
                    playerIds={partners}
                    picked={option?.kind === PowerChoiceKind.Exchange
                        ? option.withPlayerId
                        : undefined}
                    onpick={(playerId) =>
                        setOption(
                            legal,
                            i,
                            playerId === undefined ? NO_OPTION : partners.indexOf(playerId)
                        )}
                    {busy}
                />
                {#if option?.kind === PowerChoiceKind.Exchange && gameSession.myPlayer}
                    <div class="mt-1">
                        <ExchangeEditor
                            proposerId={gameSession.myPlayer.id}
                            counterpartyId={option.withPlayerId}
                            allows={exchangeAllowanceOf(legal.spec)}
                            value={picks.terms[i] ?? noExchangePicks()}
                            onchange={(value) => setTerms(i, value)}
                        />
                    </div>
                {/if}
            {:else if legal.spec.kind === PowerChoiceKind.Player && !allowsSeveral(legal)}
                <!-- A player is their chip; a second tap drops a pick only where none is legal. -->
                {@const players = playerOptions(legal.options)}
                <PlayerChips
                    label={words.player ?? `${legal.spec.what ?? 'a player'}:`}
                    playerIds={players}
                    picked={option?.kind === PowerChoiceKind.Player ? option.playerId : undefined}
                    onpick={(playerId) =>
                        tapOption(
                            legal,
                            i,
                            pick,
                            playerId === undefined ? pick : players.indexOf(playerId)
                        )}
                    {busy}
                />
            {:else if legal.spec.kind === PowerChoiceKind.FavorBank}
                {@const banks = favorBankSuits(legal.options)}
                <div class="text-oath-text-muted mb-1">{legal.spec.what ?? 'a favor bank'}:</div>
                <SuitPicker
                    suits={banks}
                    picked={option?.kind === PowerChoiceKind.FavorBank ? [option.suit] : []}
                    onpick={(suit) => tapOption(legal, i, pick, banks.indexOf(suit))}
                    {busy}
                />
            {:else if allowsSeveral(legal) && powerChoiceCards(legal.options, resolve)}
                {@const cards = powerChoiceCards(legal.options, resolve) ?? []}
                <div class="text-oath-text-muted">{legal.spec.what ?? legal.spec.kind}:</div>
                <CardChoiceRow
                    choices={cards}
                    picked={(picks.several[i] ?? []).map(String)}
                    onpick={(key) =>
                        toggleSeveral(
                            i,
                            Number(key),
                            !(picks.several[i] ?? []).includes(Number(key))
                        )}
                    {busy}
                    height={80}
                />
            {:else if allowsSeveral(legal)}
                <div class="text-oath-text-muted">{legal.spec.what ?? legal.spec.kind}:</div>
                {#each legal.options as choice, j (j)}
                    <label class="flex items-center gap-2">
                        <input
                            disabled={busy}
                            type="checkbox"
                            checked={(picks.several[i] ?? []).includes(j)}
                            onchange={(event) => toggleSeveral(i, j, event.currentTarget.checked)}
                        />
                        <span>{label(choice)}</span>
                    </label>
                {/each}
            {:else if legal.spec.kind === PowerChoiceKind.Yes}
                <label class="flex items-center gap-2">
                    <input
                        disabled={busy}
                        type="checkbox"
                        checked={pick >= 0}
                        onchange={(event) =>
                            setOption(legal, i, event.currentTarget.checked ? 0 : NO_OPTION)}
                    />
                    <span>{legal.spec.what ?? 'yes'}</span>
                </label>
            {:else}
                {@const cards = powerChoiceCards(legal.options, resolve)}
                {#if cards}
                    <div class="text-oath-text-muted">{legal.spec.what ?? legal.spec.kind}:</div>
                    <CardChoiceRow
                        choices={cards}
                        picked={pick >= 0 ? [String(pick)] : []}
                        onpick={(key) => tapOption(legal, i, pick, Number(key))}
                        {busy}
                        height={80}
                    />
                {:else}
                    <label class="flex items-center gap-2">
                        <span class="text-oath-text-muted"
                            >{legal.spec.what ?? legal.spec.kind}:</span
                        >
                        <select
                            disabled={busy}
                            class="rounded bg-oath-surface-raised px-1 py-0.5 text-xs w-fit max-w-full {tallOnPhone
                                ? 'max-sm:min-h-11'
                                : ''}"
                            value={pick}
                            onchange={(event) =>
                                setOption(legal, i, Number(event.currentTarget.value))}
                        >
                            {#if legal.spec.min === 0}
                                <option value={NO_OPTION}>none</option>
                            {:else if pick === NO_OPTION}
                                <option value={NO_OPTION} disabled></option>
                            {/if}
                            {#each legal.options as choice, j (j)}
                                <option value={j}>{label(choice)}</option>
                            {/each}
                        </select>
                    </label>
                {/if}
            {/if}
            {#if !onMap && legal.options.length === 0 && legal.spec.min > 0}
                <p class="text-oath-danger">
                    no legal {legal.spec.what ?? legal.spec.kind} right now
                </p>
            {/if}
        </div>
    {/if}
{/each}
