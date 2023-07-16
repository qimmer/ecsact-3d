import {ITransform} from "@components/Transform";
import {IXYZ} from "@src/Utils/Math";
import {mat4, vec3} from "gl-matrix";

export function moveTransform(transform:ITransform, delta:IXYZ) {
    let right = <vec3>transform.local.slice(0, 4),
        up = <vec3>transform.local.slice(4, 8),
        forward = <vec3>transform.local.slice(8, 12),
        positionDeltaX = vec3.create(),
        positionDeltaY = vec3.create(),
        positionDeltaZ = vec3.create();

    vec3.normalize(right, right);
    vec3.normalize(up, up);
    vec3.normalize(forward, forward);

    vec3.multiply(positionDeltaX, <vec3>right, vec3.fromValues(delta.x, delta.x, delta.x));
    vec3.multiply(positionDeltaY, <vec3>up, vec3.fromValues(delta.y, delta.y, delta.y));
    vec3.multiply(positionDeltaZ, <vec3>forward, vec3.fromValues(delta.z, delta.z, delta.z));

    transform.position.x += positionDeltaX[0] + positionDeltaY[0] + positionDeltaZ[0];
    transform.position.y += positionDeltaX[1] + positionDeltaY[1] + positionDeltaZ[1];
    transform.position.z += positionDeltaX[2] + positionDeltaY[2] + positionDeltaZ[2];
}
