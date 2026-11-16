<script lang="ts">
    import { Input, Label, Toggle, Helper } from 'flowbite-svelte'
    import TournamentSelect from './TournamentSelect.svelte'
    import {
        ConfigOptionType,
        listOptionDescription,
        type ConfigOption,
        type GameConfig
    } from '@tabletop/common'

    let {
        options,
        config,
        onupdate,
        idPrefix = 'tournament-option',
        seated = true
    }: {
        options: ConfigOption[]
        config: GameConfig
        onupdate: (option: ConfigOption, value: string | number | boolean | null) => void
        idPrefix?: string
        // These Games assign seats, so an option the seat decides cannot be chosen.
        seated?: boolean
    } = $props()
</script>

<div class="space-y-3">
    {#each options as option (option.id)}
        {@const value = config[option.id]}
        <div>
            {#if seated && option.seatedValue}
                <Label for={`${idPrefix}-${option.id}`} class="mb-2">{option.name}</Label>
                <Input id={`${idPrefix}-${option.id}`} value={option.seatedValue} disabled />
                <Helper class="mt-1 text-[.65rem] leading-tight"
                    >Tournament games assign seats, and the seat decides this.</Helper
                >
            {:else if option.type === ConfigOptionType.Boolean}
                <Toggle
                    id={`${idPrefix}-${option.id}`}
                    checked={config[option.id] === true}
                    onchange={(event) => onupdate(option, event.currentTarget.checked)}
                >
                    <div class="flex flex-col items-start leading-tight">
                        {option.name}
                        <Helper class="text-[.65rem] leading-tight dark:text-gray-400"
                            >{option.description}</Helper
                        >
                    </div>
                </Toggle>
            {:else}
                <Label for={`${idPrefix}-${option.id}`} class="mb-2">{option.name}</Label>
                {#if option.type === ConfigOptionType.List}
                    <TournamentSelect
                        id={`${idPrefix}-${option.id}`}
                        value={String(config[option.id] ?? '')}
                        options={option.options}
                        onchange={(value) => onupdate(option, value)}
                    />
                {:else if option.type === ConfigOptionType.NumberInput}
                    <Input
                        id={`${idPrefix}-${option.id}`}
                        type="number"
                        value={typeof value === 'number' ? value : undefined}
                        onchange={(event) =>
                            onupdate(
                                option,
                                event.currentTarget.value === ''
                                    ? null
                                    : event.currentTarget.valueAsNumber
                            )}
                    />
                {:else}
                    <Input
                        id={`${idPrefix}-${option.id}`}
                        value={String(config[option.id] ?? '')}
                        onchange={(event) => onupdate(option, event.currentTarget.value)}
                    />
                {/if}
                {@const description =
                    option.type === ConfigOptionType.List
                        ? listOptionDescription(option, value)
                        : option.description}
                {#if description}<Helper class="mt-1 text-[.65rem] leading-tight"
                        >{description}</Helper
                    >{/if}
            {/if}
        </div>
    {/each}
</div>
