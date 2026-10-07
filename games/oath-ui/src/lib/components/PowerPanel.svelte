<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { assertExists } from '@tabletop/common'
    import { cardPower, powerKey, type LegalPowerUse, type PowerUseKey } from '@tabletop/oath'
    import CardImage from '$lib/components/CardImage.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardName } from '$lib/model/names.js'
    import { MAJOR_ACTIONS } from '$lib/model/actionCatalogue.js'
    import { cardCostLine, printedPowerWords, type ActionCard } from '$lib/model/actionCards.js'

    // R-6.2, R-7.3.2 — "Action:" powers, each with the choices its text opens.
    let gameSession = getGameSession()
    let draft = $derived(gameSession.actionPowers)
    let busy = $derived(gameSession.busy)

    function powerOf(p: PowerUseKey) {
        const power = cardPower(p.cardId, p.powerIndex)
        assertExists(power, `${p.cardId} prints no power ${p.powerIndex}`)
        return power
    }
    function textOf(p: PowerUseKey): string {
        return powerOf(p).text
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
    function printed(card: ActionCard) {
        const power = powerOf(card)
        return { text: printedPowerWords(power.text), cost: cardCostLine(power.cost) }
    }
</script>

<div class="flex flex-col gap-1">
    {#if draft.powers.length === 0 && groups.length === 0}
        <p class="text-xs text-oath-text-muted">No usable "Action:" power right now.</p>
    {/if}
    {#each groups as group (group.heading)}
        <h4 class="group-heading">{group.heading}</h4>
        {#each group.cards as card (powerKey(card.cardId, card.powerIndex))}
            {@const print = printed(card)}
            {@const action = actionName(card)}
            <div class="border-t border-oath-divider pt-1.5 flex gap-2 items-start" data-action-card={card.cardId}>
                <div class="shrink-0">
                    <CardImage
                        cardId={card.cardId}
                        width={64}
                        label={cardName(card.cardId)}
                        inspect
                    />
                </div>
                <div class="grow min-w-0">
                    <div class="text-sm">
                        <span class="font-semibold">{cardName(card.cardId)}</span>
                        <span class="text-oath-text-muted text-xs">
                            — <span class="font-semibold text-oath-text">{action}:</span>
                            <TokenText text={print.text} /></span
                        >
                    </div>
                    <p class="text-xs">
                        <span class="text-oath-accent"><TokenText text={print.cost} /></span>
                        {#if card.consequence}
                            <span class="font-semibold text-oath-danger"
                                >· {card.consequence}</span
                            >
                        {/if}
                    </p>
                    <button
                        class="mt-1 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-0.5 text-xs"
                        disabled={busy}
                        onclick={() => gameSession.openActionWithCard(card)}
                    >
                        {action} with {cardName(card.cardId)}
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
        <div class="border-t border-oath-divider pt-1.5 flex gap-2 items-start">
            <div class="shrink-0">
                <CardImage cardId={p.cardId} width={64} label={cardName(p.cardId)} inspect />
            </div>
            <div class="grow min-w-0">
                <div class="text-sm">
                    <span class="font-semibold">{cardName(p.cardId)}</span>
                    <span class="text-oath-text-muted text-xs"> — {textOf(p)}</span>
                </div>
                {#if p.choices.length > 0}
                    <div class="mt-1">
                        <PowerChoicePicker
                            choices={p.choices}
                            bind:picks={() => draft.picksOf(p), (picks) => draft.setPicks(p, picks)}
                        />
                    </div>
                {/if}
                {#if reason}
                    <p class="text-[11px] text-oath-danger">
                        <TokenText text={gameSession.humanizeReason(reason) ?? ''} />
                    </p>
                {/if}
                <button
                    class="mt-1 rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-0.5 text-xs"
                    disabled={busy || !!reason}
                    onclick={() => draft.use(p)}
                >
                    Use
                </button>
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
