const degree = Math.PI / 180;
const radian = 180 / Math.PI;

export interface IVoxelConfiguration {
    chunkSizeX: number;
    chunkSizeY: number;
    chunkSizeZ: number;
}

export function triangulate(config:IVoxelConfiguration, getVoxel:(x:number, y:number, z:number)=>number, vertexData:Uint8Array, opt_vertexOffset:number) {
    let vertexOffset = opt_vertexOffset || 0;

}

function pushBlock(config:IVoxelConfiguration, vertexData:Uint8Array, chunk:Uint8Array[][], block:number, x:number, y:number, z:number, vertexOffset:number) {
    var blockHeight = 1.0,
        lastX = config.chunkSizeX - 1,
        lastY = config.chunkSizeY - 1,
        lastZ = config.chunkSizeZ - 1;

    // Left
    if ( x === 0 || chunk[x][y+1][z] === 0 )
    {
        vertexOffset = pushQuad(vertexData, 0, 1, 0,
            x, y, z + blockHeight,
            x + 1.0, y, z + blockHeight,
            x + 1.0, y + 1.0, z + blockHeight,
            x, y + 1.0, z + blockHeight,
            block,
            vertexOffset);
    }

    // Top
    if ( y === lastY || chunk[x][y+1][z] === 0 )
    {
        vertexOffset = pushQuad(vertexData, 0, 1, 0,
            x, y, z + blockHeight,
            x + 1.0, y, z + blockHeight,
            x + 1.0, y + 1.0, z + blockHeight,
            x, y + 1.0, z + blockHeight,
            block,
            vertexOffset);
    }

    return vertexOffset;
}

function pushQuad(vertexData:Uint8Array, nx: number, ny:number, nz:number, x1:number, y1:number, z1:number, x2:number, y2:number, z2:number, x3:number, y3:number, z3:number, x4:number, y4:number, z4:number, block:number, vertexOffset:number)
{
    vertexOffset = pushVertex(vertexData, x1, y1, z1, nx, ny, nz, block, vertexOffset);
    vertexOffset = pushVertex(vertexData, x2, y2, z2, nx, ny, nz, block, vertexOffset);
    vertexOffset = pushVertex(vertexData, x3, y3, z3, nx, ny, nz, block, vertexOffset);

    vertexOffset = pushVertex(vertexData, x3, y3, z3, nx, ny, nz, block, vertexOffset);
    vertexOffset = pushVertex(vertexData, x4, y4, z4, nx, ny, nz, block, vertexOffset);
    vertexOffset = pushVertex(vertexData, x1, y1, z1, nx, ny, nz, block, vertexOffset);

    return vertexOffset;
}

function pushVertex(vertexData:Uint8Array, x:number, y:number, z:number, nx:number, ny:number, nz:number, block:number, vertexOffset:number) {
    vertexData[vertexOffset++] = x;
    vertexData[vertexOffset++] = y;
    vertexData[vertexOffset++] = z;
    vertexData[vertexOffset++] = block;

    vertexData[vertexOffset++] = nx;
    vertexData[vertexOffset++] = ny;
    vertexData[vertexOffset++] = nz;
    vertexData[vertexOffset++] = 0.0; // Light

    return vertexOffset;
}
