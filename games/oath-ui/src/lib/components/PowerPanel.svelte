<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { assertExists } from '@tabletop/common'
    import { cardPower, powerKey, type LegalPowerUse, type PowerUseKey } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName } from '$lib/model/names.js'
    import { MAJOR_ACTIONS } from '$lib/model/actionCatalogue.js'
    import { answerCostText, cardCostLine, type ActionCard } from '$lib/model/actionCards.js'

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
    // R-7.1.2 — what the press pays, in gold after "Use", as a question's yes shows it.
    function useCost(p: PowerUseKey): string | undefined {
        return answerCostText(powerOf(p).cost)
    }
</script>

<div class="flex flex-col gap-1">
    {#if draft.powers.length === 0 && groups.length === 0}
        <p class="text-xs text-oath-text-muted">No usable "Action:" power right now.</p>
    {/if}
    {#each groups as group (group.heading)}
        <h4 class="group-heading">{group.heading}</h4>
        {#each group.cards as card (powerKey(card.cardId, card.powerIndex))}
            {@const action = actionName(card)}
            {@const name = cardName(card.cardId)}
            <div class="border-t border-oath-divider pt-1.5 flex gap-2 items-start" data-action-card={card.cardId}>
                <span class="relative inline-flex shrink-0">
                    <CardImage cardId={card.cardId} width={64} label={name} inspect />
                    <Magnifier
                        preview={{ cardId: card.cardId, label: name }}
                        label={name}
                        size="medium"
                    />
                </span>
                <div class="grow min-w-0">
                    <div class="text-sm">
                        <span class="font-semibold">{name}</span>
                        <span class="text-oath-text-muted text-xs">— {action}</span>
                    </div>
                    <p class="text-xs">
                        <span class="text-oath-accent"
                            ><TokenText text={cardCostLine(powerOf(card).cost)} /></span
                        >
                        {#if card.consequence}
                            <span class="font-semibold text-oath-danger"
                                >· {card.consequence}</span
                            >
                        {/if}
                    </p>
                    <button
                        class="mt-1 rounded border-[1.5px] border-oath-primary-border bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-0.5 text-xs max-sm:min-h-11"
                        disabled={busy}
                        onclick={() => gameSession.openActionWithCard(card)}
                    >
                        {action} with {name}
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
        <div
            class="border-t border-oath-divider pt-1.5 flex gap-2 items-start"
            data-action-power={p.cardId}
        >
            <span class="relative inline-flex shrink-0">
                <CardImage cardId={p.cardId} width={64} label={name} inspect />
                <Magnifier preview={{ cardId: p.cardId, label: name }} label={name} size="medium" />
            </span>
            <div class="grow min-w-0">
                <div class="text-sm font-semibold">{name}</div>
                {#if p.choices.length > 0}
                    <div class="mt-1">
                        <PowerChoicePicker
                            tallOnPhone
                            choices={p.choices}
                            bind:picks={() => draft.picksOf(p), (picks) => draft.setPicks(p, picks)}
                        />
                    </div>
                {/if}
                {#if draft.picksComplete(p)}
                    {#if reason}
                        <p class="text-[11px] text-oath-danger">
                            <TokenText text={gameSession.humanizeReason(reason) ?? ''} />
                        </p>
                    {/if}
                    <button
                        class="mt-1 inline-flex items-center gap-1 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 border-[1.5px] border-oath-primary-border px-2 py-0.5 text-xs max-sm:min-h-11"
                        disabled={busy || !!reason}
                        aria-label={cost ? `Use, paying ${cost}` : undefined}
                        onclick={() => draft.use(p)}
                    >
                        Use{#if cost}<span aria-hidden="true">·</span><span class="text-oath-accent"
                                ><TokenText text={cost} /></span
                            >{/if}
                    </button>
                {/if}
            </div>
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
