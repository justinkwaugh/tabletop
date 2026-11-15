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
        onupdate
    }: {
        options: ConfigOption[]
        config: GameConfig
        onupdate: (option: ConfigOption, value: string | number | boolean | null) => void
    } = $props()
</script>

<div class="space-y-3">
    {#each options as option (option.id)}
        {@const value = config[option.id]}
        <div>
            {#if option.type === ConfigOptionType.Boolean}
                <Toggle
                    id={`tournament-option-${option.id}`}
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
                <Label for={`tournament-option-${option.id}`} class="mb-2">{option.name}</Label>
                {#if option.type === ConfigOptionType.List}
                    <TournamentSelect
                        id={`tournament-option-${option.id}`}
                        value={String(config[option.id] ?? '')}
                        options={option.options}
                        onchange={(value) => onupdate(option, value)}
                    />
                {:else if option.type === ConfigOptionType.NumberInput}
                    <Input
                        id={`tournament-option-${option.id}`}
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
                        id={`tournament-option-${option.id}`}
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
