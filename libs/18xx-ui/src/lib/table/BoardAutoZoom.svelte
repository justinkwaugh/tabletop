<script lang="ts">
    import ViewSwitch from './ViewSwitch.svelte'
    let {
        enabled,
        onToggle,
        small = false
    }: {
        enabled: boolean
        onToggle: () => void
        small?: boolean
    } = $props()
</script>

<ViewSwitch
    {enabled}
    {onToggle}
    {small}
    label="Auto zoom"
    compactLabel="Auto"
    title={enabled
        ? 'The board zooms to follow the game. Click to keep the view still.'
        : 'The board keeps its view. Click to zoom to follow the game.'}
/>
