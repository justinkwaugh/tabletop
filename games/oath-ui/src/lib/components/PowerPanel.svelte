<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { assertExists } from '@tabletop/common'
    import {
        IMPERIAL_WARBANDS,
        cardPower,
        powerKey,
        type LegalPowerUse,
        type PowerUseKey
    } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import FavorCost from '$lib/components/FavorCost.svelte'
    import PowerMovesPicker from '$lib/components/PowerMovesPicker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName } from '$lib/model/names.js'
    import { MAJOR_ACTIONS } from '$lib/model/actionCatalogue.js'
    import CardLine from '$lib/components/CardLine.svelte'
    import {
        actionCardKey,
        actionCardLine,
        actionCardUses,
        answerCostText,
        cardCostLine,
        type ActionCard
    } from '$lib/model/actionCards.js'

    // R-6.2, R-7.3.2 — "Action:" powers, each with the choices its text opens.
    let gameSession = getGameSession()
    let draft = $derived(gameSession.actionPowers)
    let busy = $derived(gameSession.busy)

    function powerOf(p: PowerUseKey) {
        const power = cardPower(p.cardId, p.powerIndex)
        assertExists(power, `${p.cardId} prints no power ${p.powerIndex}`)
        return power
    }
    function reasonFor(p: LegalPowerUse): string | undefined {
        return draft.reasonCannotUse(p)
    }

    // R-7.4 — the cards that change an action: found here, used in that action's menu.
    let cards = $derived(gameSession.actionCards)
    let groups = $derived(
        [
            { heading: 'Makes an action possible', kind: 'makesPossible' },
            { heading: 'Changes an action', kind: 'changes' }
        ]
            .map(({ heading, kind }) => ({
                heading,
                cards: cards.filter((card) => card.kind === kind)
            }))
            .filter((group) => group.cards.length > 0)
    )

    function actionName(card: ActionCard): string {
        const entry = MAJOR_ACTIONS.find((action) => action.type === card.action)
        assertExists(entry, `${card.action} is not a major action`)
        return entry.label
    }
    // A pair's entry names both cards and pays both costs; "free" when neither costs anything.
    function entryCost(card: ActionCard): string {
        const costs = actionCardUses(card)
            .map((use) => cardCostLine(powerOf(use).cost))
            .filter((cost) => cost !== 'free')
        return costs.length > 0 ? costs.join(' · ') : 'free'
    }
    function entryLine(card: ActionCard): string {
        return actionCardUses(card)
            .map((use) => actionCardLine(use.cardId))
            .filter((line) => line !== '')
            .join(' · ')
    }
    let owner = $derived(gameSession.musterWarbandOwner ?? IMPERIAL_WARBANDS)
    const warbandColor = () => gameSession.warbandColor(owner)

    // R-7.1.2 — what the press pays, in gold after "Use", as a question's yes shows it.
    function useCost(p: PowerUseKey): string | undefined {
        return answerCostText(powerOf(p).cost)
    }
</script>

{#snippet useRow(
    p: LegalPowerUse,
    complete: boolean,
    reason: string | undefined,
    cost: string | undefined
)}
    <!-- "Use" waits for complete picks; complete picks the engine refuses show its reason instead. -->
    {#if complete && reason}
        <p class="text-[11px] text-oath-danger">
            <TokenText text={gameSession.humanizeReason(reason) ?? ''} />
        </p>
    {:else if complete}
        <button
            class="mt-1 inline-flex items-center gap-1 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 border-[1.5px] border-oath-primary-border px-2 py-0.5 text-xs max-sm:min-h-11"
            disabled={busy}
            aria-label={cost ? `Use, paying ${cost}` : undefined}
            onclick={() => draft.use(p)}
        >
            Use{#if cost}<span aria-hidden="true">·</span><span class="text-oath-accent"
                    ><TokenText text={cost} /></span
                >{/if}
        </button>
    {/if}
{/snippet}

<div class="flex flex-col gap-1">
    {#if draft.powers.length === 0 && groups.length === 0}
        <p class="text-xs text-oath-text-muted">No usable "Action:" power right now.</p>
    {/if}
    {#each groups as group (group.heading)}
        <h4 class="group-heading">{group.heading}</h4>
        {#each group.cards as card (actionCardKey(card))}
            {@const action = actionName(card)}
            {@const uses = actionCardUses(card)}
            {@const name = uses.map((use) => cardName(use.cardId)).join(' + ')}
            <div
                class="border-t border-oath-divider pt-1.5 flex gap-2 items-start"
                data-action-card={uses.map((use) => use.cardId).join(' ')}
            >
                {#each uses as use (use.cardId)}
                    {@const cardLabel = cardName(use.cardId)}
                    <span class="relative inline-flex shrink-0">
                        <CardImage cardId={use.cardId} width={64} label={cardLabel} inspect />
                        <Magnifier
                            preview={{ cardId: use.cardId, label: cardLabel }}
                            label={cardLabel}
                            size="medium"
                        />
                    </span>
                {/each}
                <div class="grow min-w-0">
                    <div class="text-sm">
                        <span class="font-semibold">{name}</span>
                        <span class="text-oath-text-muted text-xs">— {action}</span>
                    </div>
                    <p class="text-xs">
                        <CardLine
                            gives={entryLine(card)}
                            cost={entryCost(card)}
                            consequence={card.consequence}
                            {warbandColor}
                        />
                    </p>
                    <button
                        class="mt-1 rounded border-[1.5px] border-oath-primary-border bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-0.5 text-xs max-sm:min-h-11"
                        disabled={busy}
                        onclick={() => gameSession.openActionWithCard(card)}
                    >
                        {action} with {card.with ? 'both' : name}
                    </button>
                </div>
            </div>
        {/each}
    {/each}
    {#if groups.length > 0 && draft.powers.length > 0}
        <h4 class="group-heading">Action powers</h4>
    {/if}
    {#each draft.powers as p (powerKey(p.cardId, p.powerIndex))}
        {@const reason = reasonFor(p)}
        {@const name = cardName(p.cardId)}
        {@const cost = useCost(p)}
        {@const moves = draft.movesOf(p)}
        {@const complete = draft.picksComplete(p)}
        <!-- Messenger's moves sit beside its card, under its name; on a phone they run the panel's width under its card. -->
        <div
            class="border-t border-oath-divider pt-1.5 gap-2 items-start {moves
                ? 'grid grid-cols-[auto_minmax(0,1fr)] gap-y-1'
                : 'flex'}"
            data-action-power={p.cardId}
        >
            <span
                class="relative inline-flex shrink-0 {moves ? 'row-span-2 max-sm:row-span-1' : ''}"
            >
                <CardImage cardId={p.cardId} width={64} label={name} inspect />
                <Magnifier preview={{ cardId: p.cardId, label: name }} label={name} size="medium" />
            </span>
            <div class="grow min-w-0 {moves ? 'max-sm:self-center' : ''}">
                <div class="text-sm font-semibold">{name}</div>
                {#each draft.tollsOf(p) as toll (toll.cardId)}
                    <p class="mt-1 text-sm">
                        <FavorCost sign="+" count={1} />
                        {#if toll.payeeId}to <PlayerName
                                playerId={toll.payeeId}
                            />{:else}burned{/if}
                    </p>
                {/each}
                {#if !moves}
                    {#if p.choices.length > 0}
                        <div class="mt-1">
                            <PowerChoicePicker
                                tallOnPhone
                                choices={p.choices}
                                bind:picks={
                                    () => draft.picksOf(p), (picks) => draft.setPicks(p, picks)
                                }
                                tollAt={draft.moveTollAt(p)}
                            />
                        </div>
                    {/if}
                    {@render useRow(p, complete, reason, cost)}
                {/if}
            </div>
            {#if moves}
                <div class="col-start-2 min-w-0 max-sm:col-span-2 max-sm:col-start-1">
                    <PowerMovesPicker
                        {moves}
                        picks={draft.picksOf(p).moves}
                        onchange={(picks) => draft.setMoves(p, picks)}
                    />
                    {@render useRow(p, complete, reason, cost)}
                </div>
            {/if}
        </div>
    {/each}
</div>

<style>
    .group-heading {
        margin-top: 4px;
        color: var(--oath-heading);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }
</style>
