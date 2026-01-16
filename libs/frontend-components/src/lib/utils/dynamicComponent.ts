import { mount, unmount, type Component } from 'svelte'

export interface MountedDynamicComponent {
    component: Record<string, any>
    props?: Record<string, any>
    destroy: () => void
}

export type DynamicComponentConfig<T = Component> = {
    component: T
    props?: Record<string, any>
}

export type DynamicComponentMountFunction<T = Component> = (
    target: HTMLElement,
    config: DynamicComponentConfig<T>
) => MountedDynamicComponent

export type DynamicComponent<T = Component> = {
    component?: T | undefined
    load: () => Promise<T>
    mount: DynamicComponentMountFunction<T>
}

export function mountDynamicComponent<T = Component>(
    target: HTMLElement,
    config: DynamicComponentConfig<T>
): MountedDynamicComponent {
    const mountedComponent = mount(config.component as Component, {
        target,
        props: config.props || {}
    })
    return {
        component: mountedComponent,
        props: config.props,
        destroy: () => {
            unmount(mountedComponent)
        }
    }
}

export function attachDynamicComponent<T = Component>(
    component: DynamicComponent<T>,
    props?: Record<string, any>
): (element: HTMLElement) => () => void {
    return (node: HTMLElement) => {
        if (!component.component) {
            return () => {}
        }

        const mountedComponent = component.mount(node, {
            component: component.component,
            props
        })
        return () => {
            mountedComponent.destroy()
        }
    }
}
