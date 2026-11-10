<script lang="ts">
    import { MediaQuery } from 'svelte/reactivity'
    import { Contracts, type Contract } from '@tabletop/koenigrufen'
    import { contractHeading, contractSummary, contractValue } from '$lib/utils/contractText.js'

    let {
        contracts,
        onchoose
    }: {
        contracts: readonly Contract[]
        onchoose: (contract: Contract) => void
    } = $props()

    // Without hover, the first tap shows the summary and a second tap on it chooses.
    const noHover = new MediaQuery('hover: none')
    let previewed: Contract | undefined = $state()
    const shown = $derived(
        previewed !== undefined && contracts.includes(previewed) ? previewed : undefined
    )

    // A tap also enters and focuses the button before its click, which must not count as a preview.
    function previewOnHover(event: PointerEvent, contract: Contract) {
        if (event.pointerType === 'mouse') {
            previewed = contract
        }
    }

    function previewOnKeyboardFocus(event: FocusEvent, contract: Contract) {
        if (
            event.currentTarget instanceof HTMLElement &&
            event.currentTarget.matches(':focus-visible')
        ) {
            previewed = contract
        }
    }

    function choose(contract: Contract) {
        if (noHover.current && shown !== contract) {
            previewed = contract
            return
        }
        onchoose(contract)
    }
</script>

<div class="choices">
    {#each contracts as contract (contract)}
        {@const definition = Contracts[contract]}
        <button
            type="button"
            class="choice contract"
            class:previewed={shown === contract}
            onpointerenter={(event) => previewOnHover(event, contract)}
            onfocus={(event) => previewOnKeyboardFocus(event, contract)}
            onclick={() => choose(contract)}
        >
            <span>{definition.name}</span>
            <span class="value" title="Points from each opponent">{contractValue(definition)}</span>
        </button>
    {/each}
</div>
<p class="summary" aria-live="polite">
    {#if shown}
        <strong>{contractHeading(shown)}:</strong>
        {contractSummary(shown)}
    {:else}
        <span class="hint">
            {noHover.current
                ? 'Tap a contract to see what it takes, then tap it again to choose it.'
                : 'Point at a contract to see what it takes.'}
        </span>
    {/if}
</p>

<style>
    .contract {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .value {
        min-width: 1.6em;
        padding: 0 5px;
        border-radius: 999px;
        background: rgb(242 201 76 / 0.2);
        color: #f2c94c;
        font-size: 0.8em;
        font-weight: 700;
        text-align: center;
    }

    .previewed {
        box-shadow: 0 0 0 2px #f2c94c;
    }

    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .summary {
        min-height: 3.6em;
        font-size: 0.85rem;
        line-height: 1.3;
        opacity: 0.9;
    }

    .hint {
        opacity: 0.7;
        font-style: italic;
    }

    @media (max-width: 640px) {
        .choices {
            gap: 4px;
        }

        .contract {
            gap: 4px;
        }

        .value {
            min-width: 1.4em;
            padding: 0 4px;
        }

        .summary {
            min-height: 3.9em;
            font-size: 0.75rem;
        }
    }
</style>
