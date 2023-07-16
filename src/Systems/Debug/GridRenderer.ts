import {ITickable} from "@src/ITickable";
import {EntityManager} from "ecsact";
import {GridTags, IGrid} from "@components/Grid";
import {IEntityQuery} from "ecsact";
import {IMesh, IShader, RenderTags} from "@components/Render";
import {CameraTags, ICamera} from "@components/Camera";
import {GameTags, IGame} from "@components/Game";
import {Inject} from "typedi";

export class GridRenderer implements ITickable {
    private mesh: IMesh;
    private shader: IShader;
    private gridQuery: IEntityQuery<IGrid>;
    private cameraQuery: IEntityQuery<ICamera>;

    constructor(entityManager:EntityManager) {
        let game = entityManager.query<IGame>([GameTags.GAME]).singleton();

        this.mesh = game.assets.meshes["gridmesh"] = game.assets.child("gridmesh").add(RenderTags.MESH).set<IMesh>({
            vertexStreams: [{
                attributes: [
                    {
                        name: 'position',
                        type: WebGLRenderingContext.FLOAT,
                        count: 2,
                        normalize: false
                    },
                    {
                        name: 'color',
                        type: WebGLRenderingContext.FLOAT,
                        count: 4,
                        normalize: false
                    }
                ],
                data: []
            }],
            indices: []
        });

        this.shader = game.assets.shaders["gridshader"] = game.assets.child("grid_shader").add(RenderTags.SHADER).set<IShader>({
            tags: ['shader'],
            vertexSource: '#version 300 es\nuniform mat4 uWorld; uniform mat4 uView; uniform mat4 uProjection; in vec3 inPosition; out vec3 varColor; void main() { gl_Position = uProjection * uView * uWorld * vec4(inPosition, 1.0); varColor = vec3(1.0, 1.0, 1.0); }',
            pixelSource: '#version 300 es\nprecision highp float; in vec3 varColor; out vec4 outColor; void main() { outColor = vec4(varColor, 1.0); }'
        });

        this.gridQuery = entityManager.query([GridTags.GRID]);
        this.cameraQuery = entityManager.query([CameraTags.CAMERA]);
    }

    tick(deltaTime: number): void {
        this.cameraQuery.forEach(camera => {
            this.gridQuery.forEach(grid => {
                camera.commandList.push({
                    uniforms: {
                        'uView': camera.view,
                        'uProjection': camera.projection,
                        'uWorld': grid.world
                    },
                    mesh: this.mesh,
                    shader: this.shader,
                    textures: {}
                });
            });
        });
    }
}
