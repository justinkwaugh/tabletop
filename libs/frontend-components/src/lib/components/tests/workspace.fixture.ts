import { mount } from 'svelte'
import Fixture from './Workspace.fixture.svelte'

export function mountWorkspace() {
    mount(Fixture, { target: document.body })
}
