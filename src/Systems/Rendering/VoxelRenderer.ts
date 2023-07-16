import {EntityManager, IEntity, IEntityQuery} from "ecsact";
import {CameraTags, ICamera} from "@components/Camera";
import {IModel, IModelRenderer, SceneRenderingTags} from "@components/SceneRendering";
import {ILight, LightTags} from "@components/Light";
import {mat4} from "gl-matrix";
import {IMesh, IShader, RenderTags} from "@components/Render";
import {ITickable} from "@src/ITickable";
import {Service} from "typedi";

const voxelVertexSource =
`
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;

uniform mat4 uWorld, uView, uProjection;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vColor;

void main(){
    mat3 normalMat = mat3(uWorld);
    vec4 vPosition4 = uWorld * vec4(aPosition, 1.0);
    vPosition = vec3(vPosition4) / vPosition4.w;
    vNormal = vec3(normalMat * aNormal);

    vColor = aColor;
    gl_Position = uProjection * uView * vPosition4;
}
`;

const voxelFragmentSource =
`
precision mediump float;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vColor;

uniform mat4 uLightWorld;
uniform vec3 uAmbient;

void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightWorld[3].xyz - vPosition);


    vec4 diffuse = vec4(vColor, 1.0);
    float shininess = 0.0;

    // Lambert's cosine law
    float lambertian = 0.1 + (max(dot(N, L), 0.0) * 2.0);

    gl_FragColor = vec4(uAmbient + lambertian * diffuse.xyz, 1.0);
}
`;

@Service()
export class VoxelRenderer implements ITickable {
    private entityManager: EntityManager;
    private cameraQuery: IEntityQuery<ICamera>;
    private identity: mat4;
    private colorIndex: Float32Array;
    private voxelShader: IEntity & IShader;

    constructor(entityManager:EntityManager, voxelMaterials: Record<string, {
        id: number,
        color: number[]
    }>) {
        this.entityManager = entityManager;
        this.cameraQuery = entityManager.query([CameraTags.CAMERA]);
        this.identity = mat4.identity(new Float32Array(16));

        let colors:number[] = [];
        for(let i = 0; i < 256*3; ++i) {
            colors[i] = 1;
        }

        for(let name in voxelMaterials) {
            let material = voxelMaterials[name];
            colors[material.id*3+0] = material.color[0];
            colors[material.id*3+1] = material.color[1];
            colors[material.id*3+2] = material.color[2];
        }

        this.colorIndex = new Float32Array(colors);

        this.voxelShader = entityManager.child("voxel_shader").add(RenderTags.SHADER).set<IShader>({
            vertexSource: voxelVertexSource,
            pixelSource: voxelFragmentSource
        });
    }

    renderModel(camera:ICamera, model:IModel, worldMatrix?: mat4, light?:ILight|null) {
        model.subMeshes.forEach(subMesh => {
            camera.commandList.push({
                uniforms: {
                    'uView': camera.view,
                    'uProjection': camera.projection,
                    'uWorld': worldMatrix || <Float32Array>this.identity,
                    'uLightWorld': light?.world || <Float32Array>this.identity,
                    'uAmbient': [0.1, 0.1, 0.1]
                },
                mesh: <IMesh>model.mesh,
                shader: this.voxelShader,
                textures: {
                },
                offset: subMesh.indexStart || 0,
                count: subMesh.indexCount
            });

        });
    }

    tick(deltaTime: number): void {
        this.cameraQuery.forEach(camera => {
            let modelRendererQuery = this.entityManager.query<IModelRenderer>([SceneRenderingTags.MODEL_RENDERER, SceneRenderingTags.VOXEL_RENDERER].concat(camera.sceneTags)),
                lightQuery = this.entityManager.query<ILight>([LightTags.LIGHT].concat(camera.sceneTags)),
                light = lightQuery.trySingleton();

            modelRendererQuery.forEach(modelRenderer => {
                if(modelRenderer.model && modelRenderer.model.mesh && this.voxelShader) {
                    this.renderModel(camera, modelRenderer.model, modelRenderer.world, light);
                }
            });
        });
    }
}
