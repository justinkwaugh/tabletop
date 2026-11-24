<script lang="ts">
    import StartChoice from './StartChoice.svelte'
    import { marketSpaceColor, marketZone } from './marketColors.js'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session, disabled }: { session: EighteenXXSessionView; disabled: boolean } = $props()
    const money = $derived(session.presentation.money)
</script>

{#if session.stock.selectedStartCompany && session.stock.awaitingStartHome}
    <p class="start-home">
        Choose a highlighted city on the map for {session.actionCompanyName(
            session.stock.selectedStartCompany.companyId
        )}’s home.
    </p>
{:else if session.stock.selectedStartCompany}
    {@const sharesToFloat = session.sharesToFloat(session.stock.selectedStartCompany.companyId)}
    {@const home = session.stock.selectedStartHomeChoice}
    {#if home}
        <p class="start-home">
            Home: {session.placeName(home.locationId)}, {money(home.cost)} from its treasury
        </p>
    {/if}
    {#each session.presentation.startNotes?.(session.gameState, session.stock.selectedStartCompany.companyId) ?? [] as note (note)}<p
            class="start-home"
        >
            {note}
        </p>{/each}
    {#if session.stock.startSizes.length > 1}
        <div class="choices start-size-choices" role="group" aria-label="Shares to buy">
            {#each session.stock.startSizes as size (size.extra)}
                <button
                    class="start-size"
                    {disabled}
                    aria-pressed={session.stock.selectedExtraStartCertificates === size.extra}
                    data-start-extra={size.extra}
                    onclick={() => session.stock.chooseExtraStartCertificates(size.extra)}
                    >{size.percent}%</button
                >
            {/each}
        </div>
    {/if}
    {#if session.stock.presidentShareSizes.length}
        <div
            class="choices start-size-choices"
            role="group"
            aria-label={session.terms.presidentCertificate}
        >
            {#each session.stock.presidentShareSizes as size (size.shares)}
                <button
                    class="start-size"
                    {disabled}
                    aria-pressed={session.stock.selectedPresidentShares === size.shares}
                    data-president-shares={size.shares}
                    onclick={() => session.stock.chooseStartPresidentShares(size.shares)}
                    >{size.percent}%</button
                >
            {/each}
        </div>
    {/if}
    <div class="choices par-choices">
        {#each session.stock.selectedStartPrices as price (price.marketSpaceId)}
            {#if price.result.details}
                {@const space = session.stockMarketChart.space(price.marketSpaceId)}
                {@const zone = marketZone(session.presentation.marketZones, space.color)}
                <button
                    class="par-choice"
                    class:recessed={zone?.fill?.kind === 'recessed'}
                    {disabled}
                    style:background={marketSpaceColor(space.color, zone)}
                    data-start-price={price.result.details.parPrice}
                    aria-pressed={session.stock.startOptionChoices.length
                        ? session.stock.start.value('marketSpaceId') === price.marketSpaceId
                        : undefined}
                    onclick={() => void session.stock.chooseStartPrice(price.marketSpaceId)}
                >
                    <span class="par-value">{price.result.details.parPrice}</span>
                    <small>Cost {money(session.stock.startCost(price.result.details))}</small>
                    {#if sharesToFloat !== undefined}
                        <small class="float-cost"
                            >{money(sharesToFloat * price.result.details.parPrice)} to float</small
                        >
                    {/if}
                </button>
            {/if}
        {/each}
    </div>
    {#if session.stock.startOptionChoices.length}
        {#each session.stock.startOptionChoices as choice (choice.id)}
            {@const spaceId = session.stock.start.value('marketSpaceId')}
            <StartChoice
                {choice}
                spaces={spaceId
                    ? session.presentation.startChoiceSpaces?.(
                          session.gameState,
                          choice.id,
                          spaceId
                      )
                    : undefined}
                stations={session.mapView.stations}
                selected={session.stock.selectedStartOptions[choice.id]}
                {disabled}
                onChoose={(optionId) => void session.stock.chooseStartOption(choice.id, optionId)}
            />
        {/each}
    {/if}
{/if}

<style>
    .choices {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: center;
        gap: 8px;
    }
    button {
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        padding: 7px 14px;
        background: var(--rail-surface, #fffdf8);
        color: var(--rail-text, #514536);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    button[aria-pressed='true'] {
        border-color: var(--rail-focus, #8c7050);
        background: var(--rail-surface-raised, #e5d7c3);
        box-shadow: inset 0 0 0 1px var(--rail-shadow, #8c7050);
    }
    button.start-size {
        min-width: 56px;
        font-variant-numeric: tabular-nums;
    }
    button.start-size[aria-pressed='true'] {
        box-shadow: 0 0 0 2px var(--rail-focus, #8c7050);
    }
    button.par-choice {
        color: #39352f;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 5px 10px;
        border-color: var(--rail-shadow, #00000026);
    }
    .par-choice small {
        color: #39352f;
    }
    .par-choice .float-cost {
        font-weight: 700;
    }
    button.par-choice.recessed,
    .par-choice.recessed small {
        color: var(--rail-text, #39352f);
    }
    button.par-choice:hover:not(:disabled) {
        filter: brightness(0.95);
    }
    /* A price held while the title's choices are made: ringed, the others faded. */
    button.par-choice[aria-pressed='true'] {
        box-shadow: 0 0 0 2px var(--rail-focus, #8c7050);
    }
    .par-choices:has([aria-pressed='true']) button.par-choice[aria-pressed='false'] {
        opacity: 0.4;
    }
    .par-choices:has([aria-pressed='true'])
        button.par-choice[aria-pressed='false']:hover:not(:disabled) {
        opacity: 0.8;
    }
    .par-value {
        font-size: 24px;
        line-height: 26px;
        font-variant-numeric: tabular-nums;
    }
    small {
        display: block;
        font-size: 10px;
        color: var(--rail-text, #786550);
    }
</style>
