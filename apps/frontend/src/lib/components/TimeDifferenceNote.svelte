<script lang="ts">
    import { isFasterThanDaily, sharesTimeDifference } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { timeDifferenceStartsAt } from '$lib/utils/timeDifferenceStart'

    let { paceMinutes }: { paceMinutes: number } = $props()
    const { userPreferencesEditor } = getAppContext()
    const shares = $derived(sharesTimeDifference(userPreferencesEditor.values))
</script>

{#snippet timeDifference()}<a href="/privacy" target="_blank" rel="noreferrer">time difference</a
    >{/snippet}

{#if timeDifferenceStartsAt && isFasterThanDaily({ paceMinutes })}
    <p class="text-xs text-gray-400">
        {#if shares}
            Players will see your {@render timeDifference()} from them. Change this in Preferences.
        {:else}
            Your {@render timeDifference()} is hidden from other players. Change this in Preferences.
        {/if}
    </p>
{/if}

<style>
    a {
        text-decoration: underline;
        text-underline-offset: 3px;
    }
</style>
