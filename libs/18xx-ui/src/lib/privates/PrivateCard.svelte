<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    let {
        money,
        name,
        description,
        value,
        income,
        token,
        phaseColors = {},
        purchaseRange,
        imageUrl
    }: {
        money: MoneyFormat
        name: string
        description: string
        value?: number
        income?: number
        token?: StationAppearance
        phaseColors?: Readonly<Record<string, string>>
        purchaseRange?: { minimum: number; maximum?: number }
        /** Published card artwork; when present it replaces the generated card. */
        imageUrl?: string
    } = $props()
    const paragraphs = $derived(description.split('\n\n'))
</script>

<div class="private-card" class:image={!!imageUrl} data-card-image={imageUrl ? true : undefined}>
    {#if imageUrl}
        <img src={imageUrl} alt={name} />
    {:else}
        <header>
            <div class="heading">
                <h3>{name}</h3>
                {#if token}<CompanyToken appearance={token} size={28} />{/if}
            </div>
            {#if value !== undefined || income !== undefined || purchaseRange}
                <div class="values">
                    {#if income !== undefined}<span
                            >Income <strong
                                >{money(income)}{#if !purchaseRange}<small>
                                        / OR</small
                                    >{/if}</strong
                            ></span
                        >{/if}
                    {#if purchaseRange}<span class="value"
                            >Purchase <strong
                                >{money(
                                    purchaseRange.minimum
                                )}{#if purchaseRange.maximum !== undefined}–{money(
                                        purchaseRange.maximum
                                    )}{/if}</strong
                            ></span
                        >
                    {:else if value !== undefined}<span class="value"
                            >Value <strong>{money(value)}</strong></span
                        >{/if}
                </div>
            {/if}
        </header>
        {#if description}
            {#each paragraphs as paragraph, index}
                <p>
                    {#if paragraph.startsWith('**') && paragraph.endsWith('**')}<strong
                            class="intro">{paragraph.slice(2, -2)}</strong
                        >{:else}{#each paragraph.split(/(\b\d+(?:H|\+)?)/g) as part}{#if index === paragraphs.length - 1 && phaseColors[part]}<TrainBadge
                                    name={part}
                                    color={phaseColors[part]}
                                />{:else}{part}{/if}{/each}{/if}
                </p>
            {/each}
        {/if}
    {/if}
</div>

<style>
    .private-card.image {
        border: 0;
        border-radius: 10px;
        background: none;
        line-height: 0;
    }
    .private-card.image img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 10px;
    }
    .private-card {
        border: 1px solid var(--rail-border, #c9baa5);
        border-radius: 8px;
        background: var(--rail-surface, #fffdf8);
        color: var(--rail-text, #514538);
        overflow: hidden;
        font-size: 12px;
        line-height: 1.45;
        font-weight: 400;
    }
    header {
        padding: 9px 12px;
        background: var(--rail-surface-raised, #efe7db);
    }
    h3 {
        margin: 0;
        max-inline-size: 22ch;
        text-wrap: balance;
        font-size: 14px;
        font-weight: 650;
        line-height: 1.3;
    }
    .heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
    }
    .heading :global(svg) {
        flex-shrink: 0;
    }
    .value {
        margin-left: auto;
        text-align: right;
    }
    .values {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
        margin-top: 5px;
        color: var(--rail-text, #786550);
        font-size: 11px;
    }
    strong {
        color: var(--rail-text, #514538);
        font-size: 12px;
        font-weight: 600;
        margin-left: 3px;
    }
    small {
        font-size: 10px;
        font-weight: 400;
    }
    p {
        margin: 0;
        padding: 9px 12px;
    }
    p + p {
        padding-top: 0;
    }
    .intro {
        margin-left: 0;
        color: inherit;
        font-size: inherit;
        font-weight: 700;
    }
</style>
