<script lang="ts">
    import {
        FAVOR_BANK_ORDER,
        PlayerStatus,
        PowerChoiceKind,
        exchangeAllowanceOf,
        type LegalChoice,
        type PowerChoice,
        type Region,
        type Suit,
        type WarbandOwner
    } from '@tabletop/oath'
    import { PlayerName } from '@tabletop/frontend-components'
    import AnswerButton from '$lib/components/AnswerButton.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import CardLine from '$lib/components/CardLine.svelte'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import MenuToggleRow from '$lib/components/MenuToggleRow.svelte'
    import PileRows from '$lib/components/PileRows.svelte'
    import PlaceChips from '$lib/components/PlaceChips.svelte'
    import { range } from '@tabletop/common'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import TokenText from '$lib/components/TokenText.svelte'
    import ExchangeEditor from '$lib/components/ExchangeEditor.svelte'
    import BargainPicker from '$lib/components/BargainPicker.svelte'
    import PlayerChips from '$lib/components/PlayerChips.svelte'
    import SiteChips from '$lib/components/SiteChips.svelte'
    import WarbandGroupRows from '$lib/components/WarbandGroupRows.svelte'
    import { avatarImage } from '$lib/images/boardImages.js'
    import { suitImage } from '$lib/images/suitImages.js'
    import { favorToken } from '$lib/images/tileImages.js'
    import { noExchangePicks, type ExchangePicks } from '$lib/model/exchangeTerms.js'
    import { powerChoiceCards, type CardResolvers } from '$lib/model/cardChoice.js'
    import { adviserBack } from '$lib/model/cardBacks.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { MayWords, PickerWords } from '$lib/model/powerPickerWords.js'
    import type { PowerSiteRow } from '$lib/model/powerSites.js'
    import {
        cardName,
        facedownAdviserLabel,
        reliquaryLabel,
        siteName,
        slotLabel,
        suitName,
        warbandOwnerName
    } from '$lib/model/names.js'
    import {
        allowsSeveral,
        asked,
        bankRuns,
        emptyPicks,
        exchangePartners,
        favorBankSuits,
        FIRST_BRANCH,
        gridAt,
        gridCeilingAt,
        gridCounts,
        isMay,
        isOr,
        mayOf,
        NO_OPTION,
        openCountCeiling,
        openRunBanks,
        optionIndexOf,
        playerOptions,
        runAt,
        runCeilingAt,
        runSuits,
        warbandGrids,
        withBranch,
        withCount,
        withGridCount,
        withMay,
        withOptionPick,
        withRunCount,
        withRunToggled,
        type BankRun,
        type PowerChoicePicks,
        type WarbandGrid
    } from '$lib/model/powerChoices.js'

    let {
        choices,
        picks = $bindable(emptyPicks()),
        tallOnPhone = false,
        tollAt = () => false,
        words = { tone: 'gold' },
        siteOnMap = () => undefined,
        banks
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
        /**
         * R-7.3.3 — each favor bank as the picks are judged on it, when that is not the table's: a When Played
         * power's, after the play's own gains. The map keeps the table's until the play is made.
         */
        banks?: Readonly<Record<Suit, number>>
    } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let favorBank = $derived(banks ?? gameSession.gameState.favorBank)

    let countCeiling = $derived(openCountCeiling(gameSession.gameState, gameSession.myPlayer?.id))
    let grids = $derived(warbandGrids(choices))
    let runs = $derived(bankRuns(choices))
    const orWidth = new ChoiceWidth()

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

    function regionsOf(options: readonly PowerChoice[]): Region[] {
        return options.flatMap((option) =>
            option.kind === PowerChoiceKind.Region ? [option.region] : []
        )
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
    // A tap on the Nth favor sets the bank's count to N; a tap on the last one picked sets none.
    function tapRunFavor(run: BankRun, suit: Suit, count: number) {
        const now = runSuits(run, choices, picks).filter((named) => named === suit).length
        picks = withRunCount(run, choices, picks, suit, count === now ? 0 : count, favorBank[suit])
    }
    function tapRunBank(run: BankRun, suit: Suit) {
        picks = withRunToggled(run, choices, picks, suit)
    }
</script>

<!-- R-7.1.3 — a run of favor picks: a row of favor per bank that holds any, held to the run's
     total; or, where each bank is named once, one row of the banks. -->
{#snippet bankRun(run: BankRun, legal: LegalChoice)}
    {@const suits = runSuits(run, choices, picks)}
    {@const offered = favorBankSuits(legal.options)}
    <div class="text-oath-text-muted mb-1">
        <TokenText text={words.banks?.(run.total) ?? `${legal.spec.what ?? 'a favor bank'}:`} />
    </div>
    {#if run.distinct}
        {@const open = openRunBanks(run, offered, suits, favorBank)}
        <SuitPicker
            framed
            suits={offered}
            picked={suits}
            open={(suit) => open.includes(suit)}
            counts={favorBank}
            onpick={(suit) => tapRunBank(run, suit)}
            {busy}
        />
    {:else}
        <div class="flex flex-col gap-1">
            {#each FAVOR_BANK_ORDER.filter((suit) => offered.includes(suit) && favorBank[suit] > 0) as suit (suit)}
                {@const held = favorBank[suit]}
                <div class="flex items-center gap-2" data-bank-row={suit}>
                    <img
                        class="h-7 w-7 shrink-0 max-sm:h-8 max-sm:w-8"
                        src={suitImage(suit)}
                        alt={suitName(suit)}
                    />
                    <TokenRow
                        image={favorToken()}
                        {held}
                        addable={runCeilingAt(run, suits, suit, held)}
                        picked={suits.filter((named) => named === suit).length}
                        label={(n) => `${suitName(suit)} bank: ${n} favor`}
                        ontap={(n) => tapRunFavor(run, suit, n)}
                        {busy}
                    />
                </div>
            {/each}
        </div>
    {/if}
{/snippet}

<!-- A card's "or": two answers of one width, neither picked until a tap (or the one legal). -->
{#snippet orAnswers(legal: LegalChoice, i: number)}
    {@const pick = optionIndexOf(legal, i, picks)}
    {@const or = words.or}
    {#if or?.row}
        <div class="text-oath-text-muted mb-1">{or.row}</div>
    {/if}
    <div class="flex flex-wrap gap-2" role="group">
        <AnswerButton
            width={orWidth}
            picked={pick === FIRST_BRANCH}
            disabled={busy}
            label={or?.first}
            onclick={() => (picks = withBranch(picks, i, false))}
        >
            <TokenText text={or?.first ?? 'no'} />
        </AnswerButton>
        {#if legal.options.length > 0}
            <AnswerButton
                width={orWidth}
                picked={pick === 0}
                disabled={busy}
                label={or
                    ? [or.second, or.secondConsequence].filter(Boolean).join(' · ')
                    : undefined}
                onclick={() => (picks = withBranch(picks, i, true))}
            >
                <TokenText text={or?.second ?? legal.spec.what ?? 'yes'} />
                {#if or?.secondConsequence}
                    <span class="text-oath-text-muted" aria-hidden="true">·</span>
                    <span class="text-oath-danger">{or.secondConsequence}</span>
                {/if}
            </AnswerButton>
        {/if}
    </div>
{/snippet}

<!-- A card's "may": a toggle row, off, saying what the yes brings and, on its own line in rose,
     what it ends; what it gives the Chancellor first, in gold. -->
{#snippet mayLine(may: MayWords)}
    {#if may.toChancellor}
        <span class="block text-oath-accent"
            >{may.toChancellor} to <PlayerName
                playerId={gameSession.gameState.chancellorId()}
            /></span
        >
    {/if}
    <span class="block"><CardLine gives={may.gives} /></span>
    <span class="block"><CardLine consequence={may.consequence} /></span>
{/snippet}

{#snippet mayRow(legal: LegalChoice, i: number)}
    {@const on = legal.options[optionIndexOf(legal, i, picks)] !== undefined}
    {@const may = words.may}
    {@const me = gameSession.myPlayer?.id}
    {#snippet mayDetail()}
        {#if may}{@render mayLine(may)}{/if}
    {/snippet}
    <MenuToggleRow
        image={avatarImage(
            PlayerStatus.Citizen,
            me ? gameSession.colors.getPlayerColor(me) : undefined
        )}
        name={may?.name ?? legal.spec.what ?? 'yes'}
        detail={may ? mayDetail : undefined}
        {on}
        disabled={busy}
        onclick={() => (picks = withMay(choices, picks, i, !on))}
    />
{/snippet}

{#each choices as legal, i (i)}
    {@const pick = optionIndexOf(legal, i, picks)}
    {@const option = legal.options[pick]}
    {@const grid = gridAt(grids, i)}
    {@const run = runAt(runs, i)}
    {@const onMap = words.site ? siteOnMap(i) : undefined}
    {@const shown =
        (!grid || grid.specs[0] === i) &&
        (!run || run.specs[0] === i) &&
        asked(choices, i, picks) &&
        !(isMay(legal) && legal.options.length === 0)}
    <!-- A grid or a run draws every spec it answers once, at its first; a may's own pick shows
         only while the may is on, and a may the card does not offer now is not drawn. -->
    {#if shown}
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
            {:else if legal.spec.byPlace}
                <!-- One warband from a place picked whole (Wrestlers' sacrifice): a button per place. -->
                {@const places = legal.options.flatMap((o) =>
                    o.kind === PowerChoiceKind.Warbands ? [o.group.at] : []
                )}
                <PlaceChips
                    label={words.place ?? `${legal.spec.what ?? 'a place'}:`}
                    {places}
                    picked={pick === NO_OPTION ? undefined : pick}
                    onpick={(j) => tapOption(legal, i, pick, j)}
                    {busy}
                />
            {:else if legal.spec.kind === PowerChoiceKind.Bargain}
                <BargainPicker
                    {legal}
                    picks={picks.bargain[i] ?? []}
                    onchange={(value) =>
                        (picks = { ...picks, bargain: { ...picks.bargain, [i]: value } })}
                />
            {:else if run}
                {@render bankRun(run, legal)}
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
            {:else if words.siteButtons && legal.spec.kind === PowerChoiceKind.Site && !allowsSeveral(legal)}
                <!-- A site picked under its card (Small Friends): its name on a button, as a player is their chip. -->
                {@const sites = legal.options.flatMap((o) =>
                    o.kind === PowerChoiceKind.Site ? [o.siteId] : []
                )}
                <!-- Never a label with no button: with no site to name, as on the lit map. -->
                {#if sites.length > 0}
                    <SiteChips
                        label={`${legal.spec.what ?? 'a site'}:`}
                        sites={sites.map((siteId) => ({
                            siteId,
                            name: siteName(gameSession.gameState, siteId)
                        }))}
                        picked={option?.kind === PowerChoiceKind.Site ? option.siteId : undefined}
                        onpick={(siteId) => tapOption(legal, i, pick, sites.indexOf(siteId))}
                        {busy}
                    />
                {:else if legal.spec.min > 0}
                    <p class="text-oath-danger">no legal site right now</p>
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
                        ? [option.withPlayerId]
                        : []}
                    onpick={(playerId, wasPicked) =>
                        setOption(legal, i, wasPicked ? NO_OPTION : partners.indexOf(playerId))}
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
                    picked={option?.kind === PowerChoiceKind.Player ? [option.playerId] : []}
                    onpick={(playerId) => tapOption(legal, i, pick, players.indexOf(playerId))}
                    {busy}
                />
            {:else if legal.spec.kind === PowerChoiceKind.Region && !allowsSeveral(legal)}
                <!-- R-9.4 — a discard pile is a row: its top back and count, then its name. -->
                {@const regions = regionsOf(legal.options)}
                <div class="text-oath-text-muted mb-1">
                    {words.pile ?? `${legal.spec.what ?? 'a discard pile'}:`}
                </div>
                <PileRows
                    {regions}
                    picked={option?.kind === PowerChoiceKind.Region ? option.region : undefined}
                    onpick={(region) => tapOption(legal, i, pick, regions.indexOf(region))}
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
            {:else if isOr(legal)}
                {@render orAnswers(legal, i)}
            {:else if isMay(legal)}
                {@render mayRow(legal, i)}
            {:else}
                {@const cards = powerChoiceCards(legal.options, resolve)}
                {@const underMay = mayOf(choices, i) !== undefined}
                {#if cards}
                    <div class="text-oath-text-muted">
                        {underMay && words.may?.take
                            ? words.may.take
                            : `${legal.spec.what ?? legal.spec.kind}:`}
                    </div>
                    <CardChoiceRow
                        choices={cards}
                        picked={pick >= 0 ? [String(pick)] : []}
                        onpick={(key) => tapOption(legal, i, pick, Number(key))}
                        {busy}
                        height={underMay ? 56 : 80}
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
