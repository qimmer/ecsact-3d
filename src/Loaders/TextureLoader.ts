import {ITickable} from "@src/ITickable";
import {EntityManager, IEntityQuery} from "ecsact";
import {ITexture, RenderTags} from "@components/Render";
import {IPendingDownload, ResourceTags} from "@components/Resource";
import {Service} from "typedi";
import {ResourceLoader} from "@src/Loaders/ResourceLoader";

@Service()
export class TextureLoader implements ITickable {
    private textureQuery: IEntityQuery<IPendingDownload & ITexture>;
    private entityManager: EntityManager;
    private resourceLoader: ResourceLoader;

    constructor(entityManager:EntityManager, resourceLoader:ResourceLoader) {
        this.entityManager = entityManager;
        this.resourceLoader = resourceLoader;
        this.textureQuery = entityManager.query([RenderTags.TEXTURE, ResourceTags.PENDING_DOWNLOAD]);
    }

    tick(deltaTime: number): void {
        let urls = this.textureQuery.map(texture => texture.url),
            textures = this.textureQuery.map(texture => {
                texture.remove(ResourceTags.PENDING_DOWNLOAD);
                texture.add(ResourceTags.DOWNLOADING);
                return texture;
            });

        this.resourceLoader.load(urls).then(() => {
            textures.forEach(texture => {
                let url = (<IPendingDownload><any>texture).url,
                    image = <HTMLImageElement>this.resourceLoader.get(url);

                texture.layers = [
                    image
                ];
                texture.width = image.width;
                texture.height = image.height;
                texture.format = WebGLRenderingContext.RGBA;

                texture.remove(ResourceTags.DOWNLOADING);
                texture.add(ResourceTags.DOWNLOADED);
                texture.add(RenderTags.PENDING_GPU_UPLOAD);
            });
        });
    }
}
