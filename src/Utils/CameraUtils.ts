import {ICamera} from "@components/Camera";
import {mat4, vec4} from "gl-matrix";
import {IXY} from "@src/Utils/Math";

let mat = mat4.create(),
    vec = vec4.create(),
    translation;

export function worldToViewport(world:mat4, viewportPosition:IXY, camera:ICamera) {
    mat4.mul(mat, camera.projection, camera.view);
    translation = world.slice(4*3);
    vec4.transformMat4(vec, <vec4>translation, mat);
    viewportPosition.x = ((vec[0]/vec[3] + 1) * 0.5) * (camera.renderTarget?.width || 0.0);
    viewportPosition.y = (1 - ((vec[1]/vec[3] + 1) * 0.5)) * (camera.renderTarget?.height || 0.0);

    return vec[2]/vec[3];
}
