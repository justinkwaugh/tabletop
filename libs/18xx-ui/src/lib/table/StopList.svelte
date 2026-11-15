<script lang="ts" module>
    export type StopSwitch = { key: string; label: string; watched: boolean; toggle: () => void }
</script>

<script lang="ts">
    import SwitchTrack from './SwitchTrack.svelte'
    let {
        switches = [],
        always = [],
        disabled = false
    }: {
        switches?: readonly StopSwitch[]
        always?: readonly string[]
        disabled?: boolean
    } = $props()
</script>

<ul>
    {#each switches as stop (stop.key)}
        <li>
            <button
                class="switch"
                role="switch"
                aria-checked={stop.watched}
                {disabled}
                onclick={stop.toggle}
                ><SwitchTrack on={stop.watched} /><span class="condition">{stop.label}</span
                ></button
            >
        </li>
    {/each}
    {#each always as condition (condition)}
        <li class="always">{condition}</li>
    {/each}
</ul>

<style>
    ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }
    li + li {
        margin-top: 4px;
    }
    .always {
        position: relative;
        padding-left: 16px;
    }
    .always::before {
        content: '';
        position: absolute;
        left: 3px;
        top: 0.55em;
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: var(--rail-positive, #2e7d5b);
    }
    .switch {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 0;
        border: 0;
        background: transparent;
        font: inherit;
        line-height: 1.4;
        text-align: left;
        color: var(--rail-text, #e3e9ef);
        cursor: pointer;
    }
    .switch:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .switch:focus-visible {
        outline: 2px solid var(--rail-focus, #b8cddd);
        outline-offset: 1px;
    }
    .switch[aria-checked='false'] .condition {
        color: var(--rail-muted, #7f8e9e);
        text-decoration: line-through;
    }
</style>
