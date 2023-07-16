import {EntityManager, IEntity, IEntityQuery} from "ecsact";
import {CameraTags, ICamera} from "@components/Camera";
import {IModelRenderer, SceneRenderingTags} from "@components/SceneRendering";
import {mat4} from "gl-matrix";
import {IMesh, IShader, RenderTags} from "@components/Render";
import {ITickable} from "@src/ITickable";
import {Service} from "typedi";

const debugVertexSource =
`
attribute vec3 aPosition;
attribute vec3 aColor;

uniform mat4 uWorld, uView, uProjection;

varying vec3 vPosition;
varying vec3 vColor;

void main(){
    vec4 vPosition4 = uWorld * vec4(aPosition, 1.0);
    vPosition = vec3(vPosition4) / vPosition4.w;
    vColor = aColor;
    gl_Position = uProjection * uView * vPosition4;
}
`;

const debugFragmentSource =
`
precision mediump float;

varying vec3 vColor;

uniform vec4 uColor;

void main() {
    gl_FragColor = vec4(vColor, 1.0) * uColor;
    gl_FragColor.rgb *= gl_FragColor.a;
}
`;

@Service()
export class DebugRenderer implements ITickable {
    private entityManager: EntityManager;
    private cameraQuery: IEntityQuery<ICamera>;
    private identity: mat4;
    private white: Float32Array;
    private grey: Float32Array;
    private debugShader: IEntity & IShader;

    constructor(entityManager:EntityManager) {
        this.entityManager = entityManager;
        this.cameraQuery = entityManager.query([CameraTags.CAMERA]);
        this.identity = mat4.identity(new Float32Array(16));
        this.white = new Float32Array([1, 1, 1, 1]);
        this.grey = new Float32Array([1,1,1, 0.1]);

        this.debugShader = entityManager.child("debug_shader").add(RenderTags.SHADER).set<IShader>({
            vertexSource: debugVertexSource,
            pixelSource: debugFragmentSource
        });
    }

    tick(deltaTime: number): void {
        this.cameraQuery.forEach(camera => {
            let modelRendererQuery = this.entityManager.query<IModelRenderer>([SceneRenderingTags.MODEL_RENDERER, SceneRenderingTags.DEBUG_RENDERER].concat(camera.sceneTags));

            modelRendererQuery.forEach(modelRenderer => {
                if(modelRenderer.model && modelRenderer.model.mesh && this.debugShader) {
                    modelRenderer.model.subMeshes.forEach(subMesh => {
                        /*camera.commandList.push({
                            uniforms: {
                                'uView': camera.view,
                                'uProjection': camera.projection,
                                'uWorld': modelRenderer.world || <Float32Array>this.identity,
                                'uColor': this.grey
                            },
                            mesh: <IMesh>modelRenderer.model?.mesh,
                            shader: this.assets.shaders.debug,
                            textures: {
                            },
                            offset: subMesh.indexStart || 0,
                            count: subMesh.indexCount,
                            depthTest: WebGLRenderingContext.GREATER,
                            blend: true
                        });*/

                        camera.commandList.push({
                            uniforms: {
                                'uView': camera.view,
                                'uProjection': camera.projection,
                                'uWorld': modelRenderer.world || <Float32Array>this.identity,
                                'uColor': this.white
                            },
                            mesh: <IMesh>modelRenderer.model?.mesh,
                            shader: this.debugShader,
                            textures: {
                            },
                            offset: subMesh.indexStart || 0,
                            count: subMesh.indexCount,
                            depthTest: WebGLRenderingContext.LEQUAL,
                            blend: true
                        });


                    });
                }
            });
        });
    }
}
