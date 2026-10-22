<script lang="ts">
    import { CommandKind } from '@tabletop/napoleons-triumph'
    import SlidingSwitch from './SlidingSwitch.svelte'

    const ATTACH = 'attach' as const

    let {
        options,
        chosen,
        onchoose,
        attach
    }: {
        options: readonly CommandKind[]
        chosen?: CommandKind
        onchoose: (kind: CommandKind) => void
        /** Rule 9: Attach, a Corps Command that moves nothing, offered beside the moves when the unit may be attached. */
        attach?: { chosen: boolean; onchoose: () => void }
    } = $props()

    // Rule 9 names the commands that move pieces; they are listed in its order.
    const COMMANDS = [
        { value: CommandKind.Corps, name: 'Corps Move' },
        { value: CommandKind.Detach, name: 'Detach Move' },
        { value: CommandKind.Unit, name: 'Unit Move' }
    ]

    const choices = $derived([
        ...COMMANDS.map((command) => ({
            ...command,
            unavailable: !options.includes(command.value)
        })),
        ...(attach ? [{ value: ATTACH, name: 'Attach' }] : [])
    ])

    function choose(choice: CommandKind | typeof ATTACH) {
        if (choice === ATTACH) {
            attach?.onchoose()
        } else {
            onchoose(choice)
        }
    }
</script>

<SlidingSwitch
    label="Command"
    {choices}
    chosen={attach?.chosen ? ATTACH : chosen}
    onchoose={choose}
/>
