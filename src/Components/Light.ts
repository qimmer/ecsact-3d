import {ITransform, TransformTags} from "@src/Components/Transform";
import {IRGB} from "@src/Utils/Math";
import {EntityManager} from "ecsact";

export const LightTags = {
    LIGHT: 'light',
    DIRECTIONAL_LIGHT: 'directional_light',
    POINT_LIGHT: 'point_light',
    SPOT_LIGHT: 'spot_light'
}

export function LightComponent(entityManager:EntityManager) {
    entityManager.query<ILight>([LightTags.LIGHT]).subscribeAdded(entity => {
        entity.add(TransformTags.TRANSFORM);

        entity.color = {
            r: 1,
            g: 1,
            b: 1
        }
    });

    entityManager.query<IDirectionalLight>([LightTags.DIRECTIONAL_LIGHT]).subscribeAdded(entity => {
        entity.add(LightTags.LIGHT);
    });

    entityManager.query<IPointLight>([LightTags.POINT_LIGHT]).subscribeAdded(entity => {
        entity.add(LightTags.LIGHT).set({
            radius: 100.0
        }, false);
    });

    entityManager.query<ISpotLight>([LightTags.SPOT_LIGHT]).subscribeAdded(entity => {
        entity.add(LightTags.LIGHT).set({
            fov: 45.0
        }, false);
    });
}

export interface ILight extends ITransform {
    color: IRGB
}

export interface IDirectionalLight extends ILight {
    fov: number;
}

export interface IPointLight extends ILight {
    radius: number
}

export interface ISpotLight extends ILight {
    fov: number
}
