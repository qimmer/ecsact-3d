import {ITransform, TransformTags} from "./Transform";
import {IMesh, ITexture} from "./Render";
import {IRGB, IRGBA} from "@src/Utils/Math";
import {IEntity} from "ecsact";
import {EntityManager} from "ecsact";

export const SceneRenderingTags = {
    MODEL: 'model',
    MODEL_RENDERER: 'model_renderer',
    PHONG_RENDERER: 'phong_renderer',
    VOXEL_RENDERER: 'voxel_renderer',
    DEBUG_RENDERER: 'debug_renderer',
    MATERIAL: 'material',
    PHONG_MATERIAL: 'phong_material'
};

export function SceneRenderingComponent(entityManager:EntityManager) {
    entityManager.query<IModel>([SceneRenderingTags.MODEL]).subscribeAdded(entity => {
        entity.set<IModel>({
            mesh: null,
            subMeshes: []
        }, false);
    });

    entityManager.query<IModelRenderer>([SceneRenderingTags.MODEL_RENDERER]).subscribeAdded(entity => {
        entity.add(TransformTags.TRANSFORM).set<IModelRenderer>({
            model: null
        }, false);
    });

    entityManager.query<IPhongMaterial>([SceneRenderingTags.PHONG_MATERIAL]).subscribeAdded(entity => {
        entity.add(SceneRenderingTags.MATERIAL).set<IPhongMaterial>({
            diffuse: {
                r: 1.0,
                g: 1.0,
                b: 1.0,
                a: 1.0
            },
            specular: {
                r: 1.0,
                g: 1.0,
                b: 1.0
            },
            ambient: {
                r: 0.1,
                g: 0.1,
                b: 0.1,
            },
            shininess: 0.2
        }, false);
    });
}

export interface IModelRenderer extends ITransform {
    model: IModel|null,
    materialOverrides?: Record<string, IMaterial>
}

export interface IModel extends IEntity {
    mesh: IMesh|null,
    subMeshes: {
        name: string,
        indexStart?: number,
        indexCount?: number,
        material: IMaterial
    }[];
}

export interface IMaterial extends IEntity {
}

export interface IPhongMaterial extends IMaterial {
    ambient: IRGB,
    diffuse: IRGBA,
    specular: IRGB,
    shininess: number,
    textures?: {
        diffuse?: ITexture
    }
}
