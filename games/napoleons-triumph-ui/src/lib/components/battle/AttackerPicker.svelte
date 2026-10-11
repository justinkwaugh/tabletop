<script lang="ts">
    import type { DeclarationStage, FeintStage, OccupationStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CommandSwitch from '$lib/components/CommandSwitch.svelte'
    import Force from './Force.svelte'

    let { stage }: { stage: FeintStage | DeclarationStage | OccupationStage } = $props()

    const gameSession = getGameSession()
</script>

{#each stage.groups as group (group.label)}
    <div class="nt-battle-faint">{group.label}</div>
    <Force
        units={group.units}
        selected={stage.attackers}
        roles={stage.roles}
        onpick={(id) => gameSession.pickBattleUnit(id)}
    />
{:else}
    <div class="nt-battle-faint">No unit here can still be commanded.</div>
{/each}
{#if stage.attackers.length > 0}
    <div class="nt-battle-faint pt-1">Command</div>
    <div>
        <CommandSwitch
            options={stage.commandOptions}
            chosen={stage.command}
            onchoose={(command) => gameSession.chooseAttackCommand(command)}
        />
    </div>
{/if}
