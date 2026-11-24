import { mount } from 'svelte'
import Fixture from './Workspace.fixture.svelte'
import type { WorkspaceAttention } from '../workspaceTypes.js'

export function mountWorkspace(splittable = true, attention?: WorkspaceAttention) {
    mount(Fixture, { target: document.body, props: { splittable, attention } })
}
