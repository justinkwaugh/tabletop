<script lang="ts">
    import {
        TabWorkspace,
        type WorkspaceTab,
        type SavedWorkspace,
        type WorkspaceAttention
    } from '../../index.js'
    let { splittable = true, attention }: { splittable?: boolean; attention?: WorkspaceAttention } =
        $props()
    const tabs: WorkspaceTab[] = [
        { id: 'editor', label: 'Editor', closable: false },
        { id: 'preview', label: 'Preview' },
        { id: 'notes', label: 'Notes', optional: true }
    ]
    let saved: SavedWorkspace | undefined = $state()
</script>

<div class="example">
    <TabWorkspace
        {tabs}
        {splittable}
        {attention}
        label="Example"
        onLayoutChange={(value) => (saved = value)}
    >
        {#snippet children(id)}
            <label>{id} <input aria-label={`${id} draft`} /></label>
        {/snippet}
    </TabWorkspace>
</div>
<output aria-label="Saved layout">{JSON.stringify(saved)}</output>

<style>
    .example {
        height: 500px;
        font-family: sans-serif;
        --rail-text: red;
        --rail-surface: red;
    }
</style>
