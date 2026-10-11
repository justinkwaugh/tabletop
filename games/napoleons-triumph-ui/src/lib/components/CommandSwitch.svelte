<script lang="ts">
    import { CommandKind } from '@tabletop/napoleons-triumph'
    import SlidingSwitch from './SlidingSwitch.svelte'

    let {
        options,
        chosen,
        onchoose
    }: {
        options: readonly CommandKind[]
        chosen?: CommandKind
        onchoose: (kind: CommandKind) => void
    } = $props()

    // Rule 9 names the commands that move pieces; they are listed in its order.
    const COMMANDS = [
        { value: CommandKind.Corps, name: 'Corps Move' },
        { value: CommandKind.Detach, name: 'Detach Move' },
        { value: CommandKind.Unit, name: 'Unit Move' }
    ]

    const choices = $derived(
        COMMANDS.map((command) => ({ ...command, unavailable: !options.includes(command.value) }))
    )
</script>

<SlidingSwitch label="Command" {choices} {chosen} {onchoose} />
