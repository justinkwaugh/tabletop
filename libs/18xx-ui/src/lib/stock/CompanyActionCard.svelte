<script module lang="ts">
    export type CardAction = {
        label: string
        detail?: string
        ariaLabel: string
        disabled?: boolean
        onclick: () => void
    }
</script>

<script lang="ts">
    import type { Snippet } from 'svelte'
    import { getCompany } from '@tabletop/18xx'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import PrivateDescription from '../privates/PrivateDescription.svelte'
    import type { TitleFact } from '../session/titlePresentation.js'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'

    let {
        session,
        companyId,
        title,
        value,
        facts = [],
        actions = [],
        children
    }: {
        session: EighteenXXSessionView
        companyId: string
        /** The company's name, shown when the card is the subject rather than one of a list. */
        title?: string
        value?: string
        facts?: readonly TitleFact[]
        actions?: readonly CardAction[]
        /** A title's own section, between the facts and the actions. */
        children?: Snippet
    } = $props()
    const name = $derived(session.companyName(companyId))
</script>

{#snippet privateName(privateId: string)}
    {@const item = session.privates.companies.find((company) => company.id === privateId)}
    <PrivateDescription
        money={session.presentation.money}
        phaseColors={session.presentation.phaseColors}
        tokens={session.privateCardTokens[privateId]}
        imageUrl={session.publishedCardImage(privateId)}
        plate={session.publishedCardPlate(privateId)}
        shortName={session.companyName(privateId)}
        fullName={session.companyFullName(privateId)}
        description={item?.description ?? ''}
        income={!item || item.closed || session.presentation.privatesWithoutIncome
            ? undefined
            : item.revenue}
    />
{/snippet}

<div class="company-card" aria-label={name}>
    <div class="identity">
        <CompanyToken appearance={session.mapView.stations[companyId]} size={30} />
        {#if title}<span class="title">{title}</span>{/if}
        {#if value}<span class="value">{value}</span>{/if}
    </div>
    {#if facts.length}
        <dl class="facts">
            {#each facts as fact (fact.label)}<div>
                    <dt>{fact.label}</dt>
                    <dd>
                        {#if fact.trains?.length}<span class="trains"
                                >{#each fact.trains as train, index (index)}<TrainBadge
                                        name={session.trainDepot.trainDefinition(train.definitionId)
                                            .name}
                                        color={session.presentation.trainColors[train.definitionId]}
                                        obsolete={train.obsolete}
                                    />{/each}</span
                            >{:else if fact.privateIds?.length}<span class="privates"
                                >{#each fact.privateIds as privateId (privateId)}<span
                                        class="private"
                                        data-private-description-row
                                        >{@render privateName(privateId)}</span
                                    >{/each}</span
                            >{:else}{fact.value}{/if}
                    </dd>
                </div>{/each}
        </dl>
    {/if}
    {@render children?.()}
    {#if actions.length}
        <div class="actions">
            {#each actions as action (action.label)}
                <button
                    disabled={action.disabled}
                    aria-label={action.ariaLabel}
                    onclick={action.onclick}
                >
                    <span class="action-label">{action.label}</span>
                    {#if action.detail}<span class="action-detail">{action.detail}</span>{/if}
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .company-card {
        flex: none;
        max-width: 100%;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        overflow: hidden;
        color: var(--rail-text, #514536);
    }
    .identity {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: clamp(4px, 1cqw, 10px) clamp(8px, 2cqw, 18px);
        background: var(--rail-surface-raised, #f3ede4);
        font-size: 15px;
    }
    .title {
        font-size: 14px;
        font-weight: 600;
    }
    /* Each cell draws its left and top rules, pulled over the card's edge, so wrapped rows stay ruled. */
    .facts {
        display: flex;
        flex-wrap: wrap;
        margin: 0;
        border-top: 1px solid var(--rail-border, #d8cbbc);
    }
    .facts div {
        flex: 1 1 auto;
        margin: -1px 0 0 -1px;
        padding: 4px 10px;
        border-top: 1px solid var(--rail-border, #d8cbbc);
        border-left: 1px solid var(--rail-border, #d8cbbc);
        text-align: center;
    }
    dt {
        white-space: nowrap;
        font-size: 9px;
        line-height: 11px;
        text-transform: uppercase;
        letter-spacing: 0.035em;
    }
    .privates {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: center;
        column-gap: 0.3em;
    }
    .private {
        display: inline-flex;
    }
    .private:not(:last-child)::after {
        content: ',';
    }
    .trains {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 3px;
        vertical-align: middle;
    }
    dd {
        margin: 0;
        font-size: 14px;
        font-variant-numeric: tabular-nums;
    }
    /* Wrapped like the facts: each button rules its top and divides itself from the one before. */
    .actions {
        display: flex;
        flex-wrap: wrap;
        align-self: stretch;
        border-top: 1px solid var(--rail-border, #d8cbbc);
    }
    button {
        position: relative;
        flex: 1 1 auto;
        margin: -1px 0 0 -1px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        padding: clamp(3px, 0.8cqw, 8px) clamp(7px, 1.6cqw, 16px);
        border: 0;
        border-top: 1px solid var(--rail-border, #d8cbbc);
        background: var(--rail-surface-inset, #1b232d);
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    button::before {
        content: '';
        position: absolute;
        left: 0;
        top: 7px;
        bottom: 7px;
        border-left: 1px solid var(--rail-border, #d8cbbc);
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .action-label,
    .action-detail {
        white-space: nowrap;
    }
    .action-label {
        font-size: 13px;
    }
    .action-detail {
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: var(--rail-muted, #887969);
    }
</style>
