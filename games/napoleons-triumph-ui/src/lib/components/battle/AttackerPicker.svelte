<script lang="ts">
    import type { DeclarationStage, FeintStage, OccupationStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CommandSwitch from '$lib/components/CommandSwitch.svelte'
    import RideSwitch from '$lib/components/RideSwitch.svelte'
    import Force from './Force.svelte'

    let {
        stage,
        folded = false
    }: { stage: FeintStage | DeclarationStage | OccupationStage; folded?: boolean } = $props()

    const gameSession = getGameSession()
</script>

{#each stage.groups as group (group.label)}
    {#if !folded}
        <div class="nt-battle-faint">{group.label}</div>
        <Force
            units={group.units}
            selected={stage.attackers}
            roles={stage.roles}
            onpick={(id) => gameSession.pickBattleUnit(id)}
        />
    {/if}
{:else}
    <div class="nt-battle-faint">No unit here can still be commanded.</div>
{/each}
{#if stage.ride}
    <div class="pt-1">
        <RideSwitch chosen={stage.ride} onchoose={(ride) => gameSession.chooseAttackRide(ride)} />
    </div>
{/if}
{#if stage.attackers.length > 0}
    {#if !folded}
        <div class="nt-battle-faint pt-1">Command</div>
    {/if}
    <div>
        <CommandSwitch
            options={stage.commandOptions}
            chosen={stage.command}
            onchoose={(command) => gameSession.chooseAttackCommand(command)}
        />
    </div>
{/if}
