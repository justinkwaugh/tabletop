import { mount } from 'svelte'
import Fixture from './Workspace.fixture.svelte'

export function mountWorkspace(splittable = true) {
    mount(Fixture, { target: document.body, props: { splittable } })
}
