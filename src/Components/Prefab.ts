import {IEntity} from "ecsact";
import {EntityManager, IEntityQuery} from "ecsact";

export const PrefabTags = {
    PREFAB: 'prefab',
    PREFAB_LIBRARY: 'prefab_library'
};

export function PrefabComponent(entityManager:EntityManager) {
    let queries:Record<string, IEntityQuery> = {};

    function addTagRecursive(entity:any, filter:any, tags:string[]) {
        if(entity._archetype) {
            tags.forEach(tag => entity.add(tag));
        }

        for(let key in filter) {
            if(entity[key] && typeof entity[key] === 'object') {
                addTagRecursive(entity[key], filter[key], tags);
            }
        }
    }

    entityManager.query<IPrefab>([PrefabTags.PREFAB]).subscribeAdded(prefab => {
        let queryKey = prefab.triggerTags.join('|');
        if(!queries[queryKey]) {
            let query = queries[queryKey] = entityManager.query(prefab.triggerTags);
            query.subscribeAdded(instance => {
                instance.set(prefab.$data).apply();
                if(prefab.recursiveInstanceTags) {
                    addTagRecursive(instance, prefab.$data, prefab.recursiveInstanceTags);
                }
            });
        }
    });

    entityManager.query<IPrefabLibrary>([PrefabTags.PREFAB_LIBRARY]).subscribeAdded(prefabLibrary => {
        prefabLibrary.set({prefabs: []}, false);
    });
}

export interface IPrefab extends IEntity {
    recursiveInstanceTags?: string[];
    triggerTags: string[];
    $data: Object;
}

export interface IPrefabLibrary extends IEntity {
    prefabs: IPrefab[];
}
