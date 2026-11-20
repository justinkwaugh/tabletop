<script lang="ts">
    import type { StartChoice as Choice } from '@tabletop/18xx'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import type { StartChoiceSpace } from '../session/titlePresentation.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    let {
        choice,
        spaces,
        stations,
        selected,
        disabled,
        onChoose
    }: {
        choice: Choice
        /** The choice drawn as the board's spaces, where the title draws it so; else buttons. */
        spaces: readonly StartChoiceSpace[] | undefined
        stations: Readonly<Record<string, StationAppearance>>
        selected: string | undefined
        disabled: boolean
        onChoose: (optionId: string) => void
    } = $props()
    const TokenSize = 28
    const offered = (optionId: string | undefined) =>
        optionId !== undefined && choice.options.some((option) => option.id === optionId)
</script>

<!-- A start's choice: as the board prints it, held spaces showing their company and open ones
     picked, or as a button for each option. -->
<div class="start-choice" role="group" aria-label={choice.label}>
    <span class="label">{choice.label}</span>
    {#if !spaces}
        {#each choice.options as option (option.id)}
            <button
                class="option"
                {disabled}
                aria-pressed={selected === option.id}
                data-start-option={`${choice.id}:${option.id}`}
                onclick={() => onChoose(option.id)}>{option.label}</button
            >
        {/each}
    {:else}<ol class="spaces">
            {#each spaces as space, index (index)}
                <li>
                    {#if space.companyId}
                        <span class="space held" title={space.description}
                            ><CompanyToken
                                appearance={stations[space.companyId]}
                                size={TokenSize}
                            /></span
                        >
                    {:else if space.optionId !== undefined && offered(space.optionId)}
                        {@const optionId = space.optionId}
                        <button
                            class="space open"
                            {disabled}
                            title={space.description}
                            aria-label={space.description}
                            aria-pressed={selected === optionId}
                            data-start-option={`${choice.id}:${optionId}`}
                            onclick={() => onChoose(optionId)}>{space.label}</button
                        >
                    {:else}
                        <span class="space closed" title={space.description}>{space.label}</span>
                    {/if}
                </li>
            {/each}
        </ol>{/if}
</div>

<style>
    .start-choice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px 10px;
    }
    .label {
        font-size: 12px;
        font-weight: 600;
    }
    .option {
        min-width: 56px;
        padding: 7px 14px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        background: var(--rail-surface, #fffdf8);
        color: var(--rail-text, #514536);
        font: inherit;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
    }
    .option:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    .option:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    .option[aria-pressed='true'] {
        border-color: var(--rail-focus, #8c7050);
        background: var(--rail-surface-raised, #e5d7c3);
        box-shadow: 0 0 0 2px var(--rail-focus, #8c7050);
    }
    .option:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .spaces {
        display: flex;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .space {
        display: grid;
        place-items: center;
        box-sizing: border-box;
        width: 34px;
        height: 34px;
        padding: 0;
        border-radius: 50%;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }
    .space :global(svg) {
        display: block;
    }
    .open {
        border: 1.5px dashed var(--rail-border, #b8a995);
        background: none;
        color: var(--rail-text, #514536);
        cursor: pointer;
    }
    .open:hover:not(:disabled),
    .open:focus-visible {
        border-style: solid;
        border-color: #bd865e;
    }
    .open[aria-pressed='true'] {
        border: 2px solid #f2c94c;
        background: #f2c94c;
        color: #2a2416;
    }
    .open:disabled {
        cursor: default;
        opacity: 0.6;
    }
    .closed {
        border: 1px dashed var(--rail-border, #c9baa8);
        color: var(--rail-muted, #a39482);
        opacity: 0.5;
    }
</style>
