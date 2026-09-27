import './scalingWrapper.fixture.css'
import { mount, type ComponentProps } from 'svelte'
import Fixture from './ScalingWrapper.fixture.svelte'

export type WrapperFixtureProps = ComponentProps<typeof Fixture>

export function mountWrapper(props: WrapperFixtureProps = {}) {
    mount(Fixture, { target: document.body, props })
}
