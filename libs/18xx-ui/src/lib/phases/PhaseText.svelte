<script lang="ts">
    import TrainBadge from '../trains/TrainBadge.svelte'
    import { phaseTextParts } from './phaseText.js'
    let { text, phaseColors }: { text: string; phaseColors: Readonly<Record<string, string>> } =
        $props()
    const parts = $derived(phaseTextParts(text, Object.keys(phaseColors)))
</script>

{#each parts as part, index (index)}{#if part.phaseId}<TrainBadge
            name={part.phaseId}
            color={phaseColors[part.phaseId]}
        />{:else}{part.text}{/if}{/each}
