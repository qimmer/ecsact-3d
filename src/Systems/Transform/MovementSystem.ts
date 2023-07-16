import {ITickable} from "@src/ITickable";
import {EntityManager} from "ecsact";
import {IEntityQuery} from "ecsact";
import {IEulerTransform, ITransform, TransformTags} from "@components/Transform";
import {vec3} from "gl-matrix";
import {IMoving, IRelativeMoving, IRotating, MovementTags} from "@components/Movement";
import {arrayToXyz, xyzToArray} from "@src/Utils/Math";
import {Service} from "typedi";

let constrainAngle = function(x:number){
    x = (x + 180) % 360;
    if (x < 0) {
        x += 360;
    }

    return x - 180;
}

@Service()
export class MovementSystem implements ITickable {
    private movingQuery: IEntityQuery<IMoving&ITransform>;
    private rotatingQuery: IEntityQuery<IRotating&IEulerTransform>;
    private relativeMovingQuery: IEntityQuery<IRelativeMoving>;

    constructor(entityManager:EntityManager) {
        this.movingQuery = entityManager.query([TransformTags.TRANSFORM, MovementTags.MOVING]);
        this.rotatingQuery = entityManager.query([TransformTags.EULER_TRANSFORM, MovementTags.ROTATING]);
        this.relativeMovingQuery = entityManager.query([TransformTags.TRANSFORM, MovementTags.RELATIVE_MOVING, MovementTags.MOVING]);
    }

    tick(deltaTime: number): void {
        let delta = vec3.create(),
            deltaTimeVec = vec3.fromValues(deltaTime, deltaTime, deltaTime),
            quaternion = new Float32Array(4),
            vector = new Float32Array(3);

        this.relativeMovingQuery.forEach(transform => {
            let right = <vec3>transform.world.slice(0, 4),
                up = <vec3>transform.world.slice(4, 8),
                forward = <vec3>transform.world.slice(8, 12),
                positionDeltaX = vec3.create(),
                positionDeltaY = vec3.create(),
                positionDeltaZ = vec3.create(),
                delta = transform.movement;

            vec3.normalize(right, right);
            vec3.normalize(up, up);
            vec3.normalize(forward, forward);

            vec3.multiply(positionDeltaX, <vec3>right, vec3.fromValues(delta.x, delta.x, delta.x));
            vec3.multiply(positionDeltaY, <vec3>up, vec3.fromValues(delta.y, delta.y, delta.y));
            vec3.multiply(positionDeltaZ, <vec3>forward, vec3.fromValues(delta.z, delta.z, delta.z));

            transform.velocity.x = positionDeltaX[0] + positionDeltaY[0] + positionDeltaZ[0];
            transform.velocity.y = positionDeltaX[1] + positionDeltaY[1] + positionDeltaZ[1];
            transform.velocity.z = positionDeltaX[2] + positionDeltaY[2] + positionDeltaZ[2];
        });
        this.movingQuery.forEach(transform => {
            vec3.mul(delta, xyzToArray(transform.velocity), deltaTimeVec)
            vec3.add(vector, xyzToArray(transform.position), delta);

            transform.position = arrayToXyz(vector);
        });

        this.rotatingQuery.forEach(transform => {
            vec3.mul(delta, xyzToArray(transform.torque), deltaTimeVec)
            vec3.add(vector, xyzToArray(transform.rotationEuler), delta);
            vector[0] = constrainAngle(vector[0]);
            vector[1] = constrainAngle(vector[1]);
            vector[2] = constrainAngle(vector[2]);
            transform.rotationEuler = arrayToXyz(vector);
        });
    }
}
