export interface IResourceLoader {
    load(urls: string[]): Promise<Awaited<any>[]>;
    get(name: string): any;
}
