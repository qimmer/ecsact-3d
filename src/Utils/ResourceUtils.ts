import {IEntity} from "ecsact";
import {ResourceTags} from "@components/Resource";

export function downloadResource<T extends IEntity>(resource:T):Promise<T> {
    if(!resource.has(ResourceTags.DOWNLOADED) && !resource.has(ResourceTags.DOWNLOADING) && !resource.has(ResourceTags.PENDING_DOWNLOAD)) {
        resource.add(ResourceTags.PENDING_DOWNLOAD);

        return new Promise((resolve, reject) => {
            function tick() {
                if(resource.has(ResourceTags.DOWNLOADED)) {
                    resolve(resource);
                } else if(resource.has(ResourceTags.DOWNLOADING) || resource.has(ResourceTags.PENDING_DOWNLOAD)) {
                    requestAnimationFrame(tick);
                } else {
                    reject();
                }
            }
            requestAnimationFrame(tick);
        });


    } else {
        return Promise.resolve(resource);
    }
}
