import {assert, assertValue, EntityManager} from "ecsact";
import {IEntityQuery} from "ecsact";
import {IEulerTransform, ILocalTransform, ITransform, IWorldTransform, TransformTags} from "@components/Transform";
import {mat4, quat} from "gl-matrix";
import {ITickable} from "@src/ITickable";
import {arrayToXyzw, xyzToArray, xyzwToArray} from "@src/Utils/Math";
import {Service} from "typedi";

@Service()
export class WorldTransformSystem implements ITickable {
    private transformQuery: IEntityQuery<ITransform>;
    private eulerTransformQuery: IEntityQuery<IEulerTransform>;
    private entityManager: EntityManager;
    private rootTransformQuery: IEntityQuery<IWorldTransform&ITransform>;

    constructor(entityManager:EntityManager) {
        this.entityManager = entityManager;
        this.rootTransformQuery = entityManager.query([TransformTags.TRANSFORM, TransformTags.WORLD_TRANSFORM, TransformTags.TRANSFORM_LEVEL_ + 0]);
        this.transformQuery = entityManager.query([TransformTags.TRANSFORM, TransformTags.WORLD_TRANSFORM]);
        this.eulerTransformQuery = entityManager.query([TransformTags.EULER_TRANSFORM, TransformTags.TRANSFORM]);
    }

    tick(deltaTime: number): void {
        let quaternion = new Float32Array(4),
            vector = new Float32Array(3);

        this.eulerTransformQuery.forEach(transform => {
            quat.fromEuler(quaternion, transform.rotationEuler.x, transform.rotationEuler.y, transform.rotationEuler.z);
            transform.rotationQuat = arrayToXyzw(quaternion);
        });

        this.rootTransformQuery.forEach(transform => {
            mat4.fromRotationTranslationScale(transform.world, xyzwToArray(transform.rotationQuat), xyzToArray(transform.position), xyzToArray(transform.scale));
        });

        for(let level = 1;;++level) {
            let query = this.entityManager.query<ILocalTransform&ITransform>([TransformTags.LOCAL_TRANSFORM, TransformTags.TRANSFORM_LEVEL_ + level]);

            if(!query.hasAny()) {
                break;
            }

            query.forEach(transform => {
                let parent = assertValue(transform.parent || <ILocalTransform>transform.getOwner(), "Entity with non-zero transform level has no parent.");

                mat4.fromRotationTranslationScale(transform.local, xyzwToArray(transform.rotationQuat), xyzToArray(transform.position), xyzToArray(transform.scale));
                mat4.multiply(transform.world, parent.world, transform.local);
            });
        }
    }
}
