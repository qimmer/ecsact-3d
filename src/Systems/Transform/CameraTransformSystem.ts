import {ITickable} from "@src/ITickable";
import {EntityManager, IEntityQuery} from "ecsact";
import {TransformTags} from "@components/Transform";
import {glMatrix, mat4, vec3} from "gl-matrix";
import {CameraTags, ICamera, IOrthographicCamera, IPerspectiveCamera} from "@components/Camera";
import {Service} from "typedi";

@Service()
export class CameraTransformSystem implements ITickable {
    private cameraTransformQuery: IEntityQuery<ICamera>;
    private perspectiveCameraQuery: IEntityQuery<IPerspectiveCamera>;
    private orthographicCameraQuery: IEntityQuery<IOrthographicCamera>;
    private cameraZScale: any;

    constructor(entityManager:EntityManager) {
        this.cameraTransformQuery = entityManager.query([TransformTags.TRANSFORM, CameraTags.CAMERA]);
        this.perspectiveCameraQuery = entityManager.query([CameraTags.CAMERA, CameraTags.PERSPECTIVE]);
        this.orthographicCameraQuery = entityManager.query([CameraTags.CAMERA, CameraTags.ORTHOGRAPHIC]);
        this.cameraZScale = vec3.fromValues(1, 1, -1);
    }

    tick(deltaTime: number): void {
        this.cameraTransformQuery.forEach(camera => {
            mat4.invert(camera.view, mat4.scale(camera.view, camera.world, this.cameraZScale));
        });

        this.perspectiveCameraQuery.forEach(camera => {
            let renderTargetAspect = 1.0;

            if(camera.renderTarget) {
                renderTargetAspect = camera.renderTarget.width / camera.renderTarget.height;
            }

            mat4.perspective(camera.projection, glMatrix.toRadian(camera.perspective.fov), camera.perspective.aspect || renderTargetAspect, camera.clip.near, camera.clip.far);
        });

        this.orthographicCameraQuery.forEach(camera => {
            mat4.ortho(camera.projection, camera.ortho.left, camera.ortho.right, camera.ortho.bottom, camera.ortho.top, camera.clip.near, camera.clip.far);
        });
    }
}
