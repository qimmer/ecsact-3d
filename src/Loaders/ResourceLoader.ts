import {IResourceLoader} from "./IResourceLoader";
import {assert} from "ecsact";
import {Service} from "typedi";

@Service()
export class ResourceLoader implements IResourceLoader {
    private resources: Record<string, any>;

    constructor() {
        this.resources = {};
    }

    load(resourceUrls: string[]) {
        return Promise.all(resourceUrls.map(url => {
            let splits = url.split('.'),
                extension = splits[splits.length - 1],
                promise;

            switch(extension) {
                case "json":
                    promise = <Promise<any>>fetch(url).then(response => response.json()).then(value => this.resources[url] = value).catch(reason => {
                        assert(false, reason);
                    });
                    break;
                case "png":
                case "jpg":
                case "jpeg":
                    promise = new Promise((resolve, reject) => {
                        let img = <HTMLImageElement>document.createElement('img');
                        img.onload = function() {
                            resolve(img);
                        }
                        img.onerror = function(e) {
                            reject(e);
                        }
                        img.src = url;
                    }).then(value => this.resources[url] = value).catch(reason => {
                        assert(false, reason);
                    });
                    break;
                default:
                    promise = <Promise<any>>fetch(url).then(response => response.text()).then(value => this.resources[url] = value.replace(/(?:\r\n|\r|\n)/g, '\n')).catch(reason => {
                        assert(false, reason);
                    });
                    break;
            }

            return promise;
        })).catch(reason => {
            throw new Error(reason);
        });
    }

    get(name: string) {
        return this.resources[name];
    }
}
