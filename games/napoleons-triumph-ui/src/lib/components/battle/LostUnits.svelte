<script lang="ts">
    import UnitTile from '$lib/components/UnitTile.svelte'
    import type { SideLosses } from '$lib/model/attackLosses.js'
    import { lossMark } from '$lib/model/roleMark.js'

    let { side }: { side: SideLosses } = $props()
</script>

{#each side.taken as loss (loss.unitId)}
    <UnitTile
        playerId={side.playerId}
        face={loss.face}
        roleMark={lossMark(loss.steps)}
        marker={loss.eliminated ? 'destroyed' : undefined}
        label="A unit that lost steps"
        close
    />
{/each}
