import {ITickable} from "@src/ITickable";
import {EntityManager} from "ecsact";
import {IEntityQuery} from "ecsact";
import {IShader, RenderTags} from "@components/Render";
import {IPendingDownload, ResourceTags} from "@components/Resource";
import {ResourceLoader} from "@src/Loaders/ResourceLoader";
import {Service} from "typedi";

@Service()
export class ShaderLoader implements ITickable {
    private shaderQuery: IEntityQuery<IShader>;
    private entityManager: EntityManager;
    private resourceLoader: ResourceLoader;

    constructor(entityManager:EntityManager, resourceLoader:ResourceLoader) {
        this.entityManager = entityManager;
        this.resourceLoader = resourceLoader;
        this.shaderQuery = entityManager.query<IShader>([RenderTags.SHADER, ResourceTags.PENDING_DOWNLOAD, "!" + ResourceTags.DOWNLOADING]);
    }

    tick(deltaTime: number): void {
        if(this.shaderQuery.hasAny()) {
            let shaders = this.shaderQuery.map(x => <IShader>x),
                urls = shaders.map(shader => {
                    let vertUrl = (<IPendingDownload><any>shader).url + '.vert',
                        fragUrl = (<IPendingDownload><any>shader).url + '.frag';

                    shader.remove(ResourceTags.PENDING_DOWNLOAD);
                    shader.add(ResourceTags.DOWNLOADING);

                    return [vertUrl, fragUrl];
                }).flat();

            this.resourceLoader.load(urls).then(() => {
                shaders.forEach(shader => {
                    let vertUrl = (<IPendingDownload><any>shader).url + '.vert',
                        fragUrl = (<IPendingDownload><any>shader).url + '.frag';

                    shader.vertexSource = <string>this.resourceLoader.get(vertUrl);
                    shader.pixelSource = <string>this.resourceLoader.get(fragUrl);

                    shader.remove(ResourceTags.DOWNLOADING);
                    shader.add(ResourceTags.DOWNLOADED);
                    shader.add(RenderTags.PENDING_GPU_UPLOAD);
                });
            })
        }
    }
}
