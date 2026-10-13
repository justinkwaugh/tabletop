<script lang="ts">
    import { RideChoice } from '$lib/model/moveCommands.js'
    import SlidingSwitch from './SlidingSwitch.svelte'

    let { chosen, onchoose }: { chosen: RideChoice; onchoose: (ride: RideChoice) => void } =
        $props()

    const CHOICES = [
        { value: RideChoice.RidingOn, name: 'Riding on' },
        { value: RideChoice.NewCommand, name: 'New command' }
    ]
</script>

<SlidingSwitch label="Riding on or a new command" choices={CHOICES} {chosen} {onchoose} />
