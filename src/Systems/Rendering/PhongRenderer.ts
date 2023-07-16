import {EntityManager, IEntity, IEntityQuery} from "ecsact";
import {CameraTags, ICamera} from "@components/Camera";
import {IModelRenderer, IPhongMaterial, SceneRenderingTags} from "@components/SceneRendering";
import {ILight, LightTags} from "@components/Light";
import {mat4} from "gl-matrix";
import {rgbaToArray, rgbToArray} from "@src/Utils/Math";
import {IMesh, IShader, ITexture, RenderTags} from "@components/Render";
import {ITickable} from "@src/ITickable";
import {Service} from "typedi";

const phongVertexSource =
`
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;

uniform mat4 uWorld, uView, uProjection;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUV;

void main(){
    mat3 normalMat = mat3(uWorld);
    vec4 vPosition4 = uWorld * vec4(aPosition, 1.0);
    vPosition = vec3(vPosition4) / vPosition4.w;
    vNormal = vec3(normalMat * aNormal);
    vUV = aUV;
    gl_Position = uProjection * uView * vPosition4;
}
`;


const phongFragmentSource =
`
precision mediump float;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUV;

uniform mat4 uLightWorld;
uniform vec4 uDiffuse;
uniform vec3 uAmbient;
uniform vec3 uSpecular;
uniform float uShininess;

uniform sampler2D sDiffuse;

void main() {
    vec4 s = texture2D(sDiffuse, vUV);
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightWorld[3].xyz - vPosition);
    vec4 diffuse = uDiffuse;

    // Lambert's cosine law
    float lambertian = max(dot(N, L), 0.4);
    float specular = 0.0;

    diffuse *= s;

    if(lambertian > 0.0) {
        vec3 R = reflect(-L, N);      // Reflected light vector
        vec3 V = normalize(-vPosition); // Vector to viewer
        // Compute the specular term
        float specAngle = max(dot(R, V), 0.0);
        specular = min(pow(specAngle, uShininess), 100.0);
    }
    gl_FragColor = vec4(uAmbient + lambertian * diffuse.xyz + specular * uSpecular, uDiffuse.a);
}

`;

@Service()
export class PhongRenderer implements ITickable {
    private entityManager: EntityManager;
    private cameraQuery: IEntityQuery<ICamera>;
    private identity: mat4;
    private whiteTexture: IEntity & ITexture;
    private phongShader: IEntity & IShader;

    constructor(entityManager:EntityManager) {
        this.entityManager = entityManager;
        this.cameraQuery = entityManager.query([CameraTags.CAMERA]);
        this.identity = mat4.identity(new Float32Array(16));

        this.whiteTexture = entityManager.child("white").add(RenderTags.TEXTURE).set<ITexture>({
            width: 1,
            height: 1,
            format: WebGLRenderingContext.RGBA,
            layers: [
                new Uint8Array([255, 255, 255, 255])
            ]
        });

        this.phongShader = entityManager.child("phong").add(RenderTags.SHADER).set<IShader>({
            vertexSource: phongVertexSource,
            pixelSource: phongFragmentSource
        });
    }

    tick(deltaTime: number): void {
        this.cameraQuery.forEach(camera => {
            let modelRendererQuery = this.entityManager.query<IModelRenderer>([SceneRenderingTags.MODEL_RENDERER, SceneRenderingTags.PHONG_RENDERER].concat(camera.sceneTags)),
                lightQuery = this.entityManager.query<ILight>([LightTags.LIGHT].concat(camera.sceneTags)),
                light = lightQuery.trySingleton();

            modelRendererQuery.forEach(modelRenderer => {
                if(modelRenderer.model && modelRenderer.model.mesh && this.whiteTexture && this.phongShader) {
                    modelRenderer.model.subMeshes.forEach(subMesh => {
                        let material = (<IPhongMaterial>subMesh.material);
                        camera.commandList.push({
                            uniforms: {
                                'uView': camera.view,
                                'uProjection': camera.projection,
                                'uWorld': modelRenderer.world || <Float32Array>this.identity,
                                'uLightWorld': light?.world || <Float32Array>this.identity,
                                'uAmbient': rgbToArray(material.ambient),
                                'uDiffuse': rgbaToArray(material.diffuse),
                                'uSpecular': rgbToArray(material.specular),
                                'uShininess': material.shininess
                            },
                            mesh: <IMesh>modelRenderer.model?.mesh,
                            shader: this.phongShader,
                            textures: {
                                'sDiffuse': material.textures?.diffuse || this.whiteTexture
                            },
                            offset: subMesh.indexStart || 0,
                            count: subMesh.indexCount
                        });

                    });
                }
            });
        });
    }
}
