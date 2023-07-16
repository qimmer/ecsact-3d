import {IEntity, EntityManager} from "ecsact";

export const ResourceTags = {
    RESOURCE: 'resource',
    DISPOSED: 'disposed',
    LAZY_LOADED: 'lazy_loaded',
    PENDING_DOWNLOAD: 'pending_download',
    DOWNLOADING: 'downloading',
    DOWNLOADED: 'downloaded',
}

export interface IResource extends IEntity {
}

export interface IDisposable {
}

export interface IPendingDownload extends IResource {
    url: string
}

export function ResourceComponent(entityManager:EntityManager) {
    entityManager.query<IPendingDownload>([ResourceTags.PENDING_DOWNLOAD]).subscribeAdded(entity => {
        entity.set<IPendingDownload>({
            url: ""
        }, false)
    });

    entityManager.query<IPendingDownload>([ResourceTags.DOWNLOADING]).subscribeRemoved(entity => {
        entity.set({
            url: undefined
        });
    });
}
