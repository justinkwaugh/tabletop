<script lang="ts">
    import { onMount } from 'svelte'
    import { Harness, mountDynamicComponent } from '@tabletop/frontend-components'
    import { UiDefinition } from '@tabletop/1846-ui'
    let target: HTMLDivElement
    onMount(
        () =>
            mountDynamicComponent(target, {
                component: Harness,
                props: { definition: UiDefinition }
            }).destroy
    )
</script>

<svelte:head><title>1846 — Construction prototype</title></svelte:head>
<div bind:this={target}></div>
