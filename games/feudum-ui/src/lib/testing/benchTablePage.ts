import { mount } from 'svelte'
import GameTable from '$lib/components/GameTable.svelte'
import { BenchScenes, type BenchScene, type BenchSceneName } from './benchScenes.js'
import { guildTable, type GuildTable } from './guildTable.js'
import { settled } from './sessionHarness.js'

export async function openBenchTable(name: BenchSceneName): Promise<GuildTable> {
    const scene: BenchScene = BenchScenes[name]
    const turn = await guildTable(scene.arrange, scene.cards)
    const { session } = turn
    await settled(session)
    const target = document.createElement('div')
    target.dataset.gameUi = 'feudum'
    target.style.height = '100vh'
    document.body.replaceChildren(target)
    Object.assign(window, { feudumSession: session })
    mount(GameTable, { target, props: { gameSession: session } })
    return turn
}
