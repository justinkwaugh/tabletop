<script lang="ts">
    import SessionStandings from '$lib/components/standings/SessionStandings.svelte'
    import Scrim from './Scrim.svelte'

    /** Contract, Phone layout: the Guilds sheet is for looking and holds no target. */
    let { onClose }: { onClose: () => void } = $props()

    const SheetShare = 80
</script>

<Scrim label="the guild standings" layer="guilds" {onClose} sheet={SheetShare}>
    <div class="px-2 pb-3 pt-10" data-guilds-sheet>
        <SessionStandings />
    </div>
</Scrim>
