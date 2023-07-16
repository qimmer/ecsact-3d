import {ITickable} from "@src/ITickable";
import {EntityManager} from "ecsact";
import {IEntityQuery} from "ecsact";
import {IShader, ITexture, RenderTags} from "@components/Render";
import {IPendingDownload, ResourceTags} from "@components/Resource";
import {IPrefab, IPrefabLibrary, PrefabTags} from "@components/Prefab";
import {ResourceLoader} from "@src/Loaders/ResourceLoader";
import {Service} from "typedi";

@Service()
export class PrefabLoader implements ITickable {
    private prefabLibraryQuery: IEntityQuery<IPendingDownload & IPrefabLibrary>;
    private entityManager: EntityManager;
    private resourceLoader: ResourceLoader;

    constructor(entityManager:EntityManager, resourceLoader:ResourceLoader) {
        this.entityManager = entityManager;
        this.resourceLoader = resourceLoader;
        this.prefabLibraryQuery = entityManager.query([PrefabTags.PREFAB_LIBRARY, ResourceTags.PENDING_DOWNLOAD]);
    }

    tick(deltaTime: number): void {
        let urls = this.prefabLibraryQuery.map(prefabLibrary => prefabLibrary.url),
            prefabLibraries = this.prefabLibraryQuery.map(prefabLibrary => {
                prefabLibrary.remove(ResourceTags.PENDING_DOWNLOAD);
                prefabLibrary.add(ResourceTags.DOWNLOADING);
                return prefabLibrary;
            });

        this.resourceLoader.load(urls).then(() => {
            prefabLibraries.forEach(prefabLibrary => {
                let url = (<IPendingDownload><any>prefabLibrary).url,
                    json = <string>this.resourceLoader.get(url),
                    prefabsByTags = <Record<string, Object>><any>json;

                for(var prefabKey in prefabsByTags) {
                    let prefabData = prefabsByTags[prefabKey];
                    prefabLibrary.prefabs.push(prefabLibrary
                        .child(prefabKey)
                        .add(PrefabTags.PREFAB)
                        .set<IPrefab>({
                            triggerTags: prefabKey.split('|'),
                            recursiveInstanceTags: (<any>prefabData).recursiveInstanceTags,
                            $data: prefabData}));
                }

                prefabLibrary.remove(ResourceTags.DOWNLOADING);
                prefabLibrary.add(ResourceTags.DOWNLOADED);
            });
        });
    }
}
