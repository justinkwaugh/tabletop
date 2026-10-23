<script lang="ts" generics="Choice extends CommandChoice">
    import { CommandKind } from '@tabletop/napoleons-triumph'
    import { ATTACH, type CommandChoice } from '$lib/model/moveCommands.js'
    import SlidingSwitch from './SlidingSwitch.svelte'

    let {
        options,
        chosen,
        onchoose
    }: {
        options: readonly Choice[]
        chosen?: Choice
        onchoose: (choice: Choice) => void
    } = $props()

    // Rule 9 names the commands that move pieces; they are listed in its order, then Attach, which moves nothing, when it is offered.
    const COMMANDS: { value: CommandChoice; name: string }[] = [
        { value: CommandKind.Corps, name: 'Corps Move' },
        { value: CommandKind.Detach, name: 'Detach Move' },
        { value: CommandKind.Unit, name: 'Unit Move' },
        { value: ATTACH, name: 'Attach' }
    ]

    const choices = $derived(
        COMMANDS.filter(
            (command) => command.value !== ATTACH || options.some((option) => option === ATTACH)
        ).map((command) => ({
            ...command,
            unavailable: !options.some((option) => option === command.value)
        }))
    )

    function choose(value: CommandChoice) {
        const offered = options.find((option) => option === value)
        if (offered !== undefined) {
            onchoose(offered)
        }
    }
</script>

<SlidingSwitch label="Command" {choices} {chosen} onchoose={choose} />
