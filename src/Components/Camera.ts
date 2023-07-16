import {IEulerTransform, ITransform, TransformTags} from "./Transform";
import {IRenderList, RenderTags} from "./Render";
import {mat4} from "gl-matrix";
import {EntityManager} from "ecsact";

export const CameraTags = {
    CAMERA: 'camera',
    PERSPECTIVE: 'perspective',
    ORTHOGRAPHIC: 'orthographic',

    DEBUG_CAMERA: 'debug_camera',
    TOP_DOWN_CAMERA: 'top_down_camera',
    TARGETED_CAMERA: 'targeted_camera'
}


export function CameraComponent(entityManager:EntityManager) {
    entityManager.query<ICamera>([CameraTags.CAMERA]).subscribeAdded(entity => {
        entity.add(TransformTags.TRANSFORM).add(RenderTags.RENDER_LIST).set({
            sceneTags: [],
            view: mat4.identity(new Float32Array(16)),
            projection: mat4.identity(new Float32Array(16)),
            clip: {
                near: 0.1,
                far: 1000.0
            }
        }, false);
    });

    entityManager.query<IPerspectiveCamera>([CameraTags.PERSPECTIVE]).subscribeAdded(entity => {
        entity
            .add(CameraTags.CAMERA)
            .set<IPerspectiveCamera>({
                perspective: {
                    fov: 90.0,
                    aspect: 1.0
                }
            }, false);

    });

    entityManager.query<IOrthographicCamera>([CameraTags.ORTHOGRAPHIC]).subscribeAdded(entity => {
        entity
            .add(CameraTags.CAMERA)
            .set<IOrthographicCamera>({
                ortho: {
                    left: 0,
                    right: 0,
                    top: 1,
                    bottom: 1
                }
            }, false);
    });

}

export interface ICamera extends ITransform, IRenderList {
    sceneTags: string[];
    view: mat4,
    projection: mat4,
    clip: {
        near: number;
        far: number;
    }
}

export interface IPerspectiveCamera extends ICamera {
    perspective: {
        fov: number;
        aspect: number;
    }
}

export interface IOrthographicCamera extends ICamera {
    ortho: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    }
}
