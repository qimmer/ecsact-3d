import {IAttribute, IMesh, IVertexStream} from "@components/Render";
import {vec3} from "gl-matrix";

export function getVertexCount(mesh:IMesh): number {
    let firstStream = mesh.vertexStreams[0],
        byteCount = firstStream.data ? ((firstStream.data instanceof Float32Array) ? (4 * firstStream.data.length) : firstStream.data.length) : 0;

    return byteCount / getStreamStride(firstStream);
}

export function getTypeSizeInBytes(type:GLenum) {
    switch (type) {
        case WebGLRenderingContext.FLOAT:
            return 4;
        case WebGLRenderingContext.UNSIGNED_BYTE:
            return 1;
        default:
            throw new Error('Unknown vertex attribute type');
    }
}

export function getAttributeSizeInBytes(attribute:IAttribute) {
    return attribute.count * getTypeSizeInBytes(attribute.type);
}

export function getStreamStride(stream:IVertexStream) {
    return stream.attributes.reduce((acc, attribute) => acc + getAttributeSizeInBytes(attribute), 0);
}

export function flipTriangleOrder(indices:number[]) {
    for(let i = 0; i < indices.length / 3; ++i) {
        let offset = i*3,
            index = indices[offset];

        indices[offset] = indices[offset+2];
        indices[offset+2] = index;
    }
}

export function fixTriangleOrderFromNormals(indices:number[], positions:number[], normals:number[]) {
    let expectedNormal = vec3.create(),
        agreement = 0,
        actualNormal = vec3.create(),
        a = vec3.create(),
        b = vec3.create(),
        c = vec3.create(),
        bSuba = vec3.create(),
        cSubb = vec3.create();

    for(let i = 0; i < indices.length / 3; ++i) {
        let offset = i*3,
            index0 = indices[offset+0]*3,
            index1 = indices[offset+1]*3,
            index2 = indices[offset+2]*3,
            px = [positions[index0+0], positions[index1+0], positions[index2+0]],
            py = [positions[index0+1], positions[index1+1], positions[index2+1]],
            pz = [positions[index0+2], positions[index1+2], positions[index2+2]],
            nx = [normals[index0+0], normals[index1+0], normals[index2+0]],
            ny = [normals[index0+1], normals[index1+1], normals[index2+1]],
            nz = [normals[index0+2], normals[index1+2], normals[index2+2]];

        vec3.set(a, px[0], py[0], pz[0]);
        vec3.set(b, px[1], py[1], pz[1]);
        vec3.set(c, px[2], py[2], pz[2]);
        vec3.subtract(bSuba, b, a);
        vec3.subtract(cSubb, c, b);
        vec3.set(actualNormal, (nx[0] + nx[1] + nx[2])/3, (ny[0] + ny[1] + ny[2])/3, (nz[0] + nz[1] + nz[2])/3);

        vec3.cross(expectedNormal, bSuba, cSubb);
        agreement = vec3.dot(expectedNormal, actualNormal);

        if(agreement < 0) {
            let index = indices[offset];
            indices[offset] = indices[offset+2];
            indices[offset+2] = index;
        }
    }
}
