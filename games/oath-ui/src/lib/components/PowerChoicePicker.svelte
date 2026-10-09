<script lang="ts">
    import {
        PowerChoiceKind,
        exchangeAllowanceOf,
        type ExchangeTerms,
        type LegalChoice,
        type PowerChoice,
        type WarbandOwner
    } from '@tabletop/oath'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import CountPicker from '$lib/components/CountPicker.svelte'
    import { range } from '@tabletop/common'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
    import ExchangeEditor from '$lib/components/ExchangeEditor.svelte'
    import { powerChoiceCards, type CardResolvers } from '$lib/model/cardChoice.js'
    import { adviserBack } from '$lib/model/cardBacks.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        cardName,
        facedownAdviserLabel,
        reliquaryLabel,
        siteName,
        warbandOwnerName
    } from '$lib/model/names.js'
    import {
        allowsSeveral,
        emptyPicks,
        favorBankSuits,
        NO_OPTION,
        openCountCeiling,
        optionIndexOf,
        severalCountKey,
        withCount,
        withOptionPick,
        withSeveralCount,
        type PowerChoicePicks
    } from '$lib/model/powerChoices.js'

    let {
        choices,
        picks = $bindable(emptyPicks())
    }: { choices: LegalChoice[]; picks?: PowerChoicePicks } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)

    let countCeiling = $derived(openCountCeiling(gameSession.gameState, gameSession.myPlayer?.id))

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
                return siteName(gameSession.gameState, option.siteId)
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
        }
    }

    function severalLabel(option: PowerChoice): string {
        if (option.kind !== PowerChoiceKind.Warbands || option.group.at.kind !== 'board')
            return label(option)
        return `${ownerName(option.group.owner)}, up to ${option.group.count}, to ${gameSession.getPlayerName(
            option.group.at.playerId
        )}'s board`
    }

    function setOption(legal: LegalChoice, i: number, pick: number) {
        picks = withOptionPick(picks, legal, i, pick)
    }
    function setCount(legal: LegalChoice, i: number, count: number) {
        picks = withCount(picks, legal, i, count)
    }
    function setTerms(i: number, value: ExchangeTerms) {
        picks = { ...picks, terms: { ...picks.terms, [i]: value } }
    }
    function toggleSeveral(i: number, j: number, on: boolean) {
        const rest = (picks.several[i] ?? []).filter((picked) => picked !== j)
        picks = { ...picks, several: { ...picks.several, [i]: on ? [...rest, j] : rest } }
    }
    function setSeveralCount(legal: LegalChoice, i: number, j: number, count: number) {
        picks = withSeveralCount(picks, legal, i, j, count)
    }
</script>

{#each choices as legal, i (i)}
    {@const pick = optionIndexOf(legal, i, picks)}
    {@const option = legal.options[pick]}
    <div class="mb-1 text-xs">
        {#if legal.spec.kind === PowerChoiceKind.Count}
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="text-oath-text-muted">{legal.spec.what ?? 'how many'}:</span>
                <CountPicker
                    values={range(0, countCeiling + 1)}
                    picked={picks.count[i] ?? 0}
                    label={(n) => `${legal.spec.what ?? 'how many'}: ${n}`}
                    onpick={(n) => setCount(legal, i, n)}
                    disabled={busy}
                />
            </div>
        {:else if legal.spec.kind === PowerChoiceKind.FavorBank}
            {@const banks = favorBankSuits(legal.options)}
            <div class="text-oath-text-muted mb-1">{legal.spec.what ?? 'a favor bank'}:</div>
            <SuitPicker
                suits={banks}
                picked={option?.kind === PowerChoiceKind.FavorBank ? [option.suit] : []}
                onpick={(suit) => tapOption(legal, i, pick, banks.indexOf(suit))}
                {busy}
            />
        {:else if allowsSeveral(legal) && powerChoiceCards(legal.options, resolve) && !legal.options.some((o) => o.kind === PowerChoiceKind.Warbands)}
            {@const cards = powerChoiceCards(legal.options, resolve) ?? []}
            <div class="text-oath-text-muted">{legal.spec.what ?? legal.spec.kind}:</div>
            <CardChoiceRow
                choices={cards}
                picked={(picks.several[i] ?? []).map(String)}
                onpick={(key) =>
                    toggleSeveral(i, Number(key), !(picks.several[i] ?? []).includes(Number(key)))}
                {busy}
                height={80}
            />
        {:else if allowsSeveral(legal)}
            <div class="text-oath-text-muted">{legal.spec.what ?? legal.spec.kind}:</div>
            {#each legal.options as choice, j (j)}
                {@const ticked = (picks.several[i] ?? []).includes(j)}
                <div class="flex items-center gap-2">
                    <label class="flex items-center gap-2 grow">
                        <input
                            disabled={busy}
                            type="checkbox"
                            checked={ticked}
                            onchange={(event) => toggleSeveral(i, j, event.currentTarget.checked)}
                        />
                        <span>{severalLabel(choice)}</span>
                    </label>
                    {#if ticked && choice.kind === PowerChoiceKind.Warbands}
                        {@const max = choice.group.count}
                        <CountPicker
                            values={range(1, max)}
                            picked={picks.severalCount[severalCountKey(i, j)] ?? max}
                            label={(n) => `how many: ${n}`}
                            onpick={(n) => setSeveralCount(legal, i, j, n)}
                            disabled={busy}
                        />
                    {/if}
                </div>
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
                    <span class="text-oath-text-muted">{legal.spec.what ?? legal.spec.kind}:</span>
                    <select
                        disabled={busy}
                        class="rounded bg-oath-surface-raised px-1 py-0.5 text-xs grow"
                        value={pick}
                        onchange={(event) => setOption(legal, i, Number(event.currentTarget.value))}
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
            {#if option?.kind === PowerChoiceKind.Exchange && gameSession.myPlayer}
                <div class="mt-1">
                    <ExchangeEditor
                        proposerId={gameSession.myPlayer.id}
                        counterpartyId={option.withPlayerId}
                        allows={exchangeAllowanceOf(legal.spec)}
                        value={picks.terms[i] ?? {}}
                        onchange={(value) => setTerms(i, value)}
                    />
                </div>
            {/if}
            {#if option?.kind === PowerChoiceKind.Warbands}
                {@const max = option.group.count}
                <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span class="text-oath-text-muted">how many:</span>
                    <CountPicker
                        values={range(1, max)}
                        picked={picks.count[i] ?? max}
                        label={(n) => `how many: ${n}`}
                        onpick={(n) => setCount(legal, i, n)}
                        disabled={busy}
                    />
                </div>
            {/if}
        {/if}
        {#if legal.options.length === 0 && legal.spec.min > 0}
            <p class="text-oath-danger">no legal {legal.spec.what ?? legal.spec.kind} right now</p>
        {/if}
    </div>
{/each}
