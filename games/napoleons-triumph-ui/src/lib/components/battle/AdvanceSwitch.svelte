<script lang="ts">
    import { commanderDefinition } from '@tabletop/napoleons-triumph'
    import SlidingSwitch from '../SlidingSwitch.svelte'

    let {
        commanderId,
        goes,
        mustGo,
        onchoose
    }: {
        commanderId: string
        goes: boolean
        mustGo: boolean
        onchoose: (goes: boolean) => void
    } = $props()

    const ALONE = 'alone'
    const WITH_COMMANDER = 'with'

    const name = $derived(commanderDefinition(commanderId).name)
    const choices = $derived([
        { value: ALONE, name: 'Alone', unavailable: mustGo },
        { value: WITH_COMMANDER, name: `With ${name}` }
    ])
</script>

<SlidingSwitch
    label="Advance alone or with {name}"
    {choices}
    chosen={goes ? WITH_COMMANDER : ALONE}
    onchoose={(value) => onchoose(value === WITH_COMMANDER)}
/>
