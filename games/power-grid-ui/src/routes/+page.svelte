<script lang="ts">
    import { onMount } from 'svelte'
    import { Harness, mountDynamicComponent } from '@tabletop/frontend-components'
    import { UiDefinition } from '../lib/definitions/definition.js'
    import '../app.css'
    let target: HTMLDivElement
    onMount(
        () =>
            mountDynamicComponent(target, {
                component: Harness,
                props: { definition: UiDefinition }
            }).destroy
    )
</script>

<svelte:head><title>Power Grid</title></svelte:head>
<div bind:this={target}></div>
