import {IEntity} from "ecsact";
import {IResource, ResourceTags} from "./Resource";
import {EntityManager} from "ecsact";

export const RenderTags = {
    RENDER_LIST: 'render_list',
    MESH: 'mesh',
    TEXTURE: 'texture',
    SHADER: 'shader',
    RENDERTARGET: 'render_target',
    OFFSCREEN_RENDERTARGET: 'offscreen_render_target',
    CANVAS_RENDERTARGET: 'canvas_render_target',

    PENDING_GPU_UPLOAD: 'pending_gpu_upload'
}

export interface IRenderTarget extends IEntity {
    width:number;
    height:number;
}

export interface IOffscreenRenderTarget extends IRenderTarget {
    textures: ITexture[];
}

export interface ICanvasRenderTarget extends IRenderTarget {
    canvas: HTMLCanvasElement|null
}

export interface IAttribute {
    name: string,
    count: number,
    type: GLenum;
    normalize?: boolean;
    stride?: number;
    offset?: number;
}

export interface IVertexStream {
    attributes: IAttribute[],
    data?: number[]
}

export interface IMesh extends IResource {
    vertexStreams: IVertexStream[];
    indices: number[]|null;
    primitiveType?: GLenum;
}

export interface IShader extends IResource {
    vertexSource: string;
    pixelSource: string;
}

export interface ITexture extends IResource {
    layers: (Uint8Array|HTMLImageElement|null)[];
    width:number;
    height:number;
    format:GLenum;
}

export interface IRenderCommand {
    mesh: IMesh,
    shader: IShader,
    uniforms: Record<string, Float32Array|number[]|number>,
    textures: Record<string, ITexture|null>,
    offset?: number,
    count?: number,
    depthTest?: GLenum,
    blend?: boolean
}

export interface IRenderList extends IEntity {
    renderTarget: IRenderTarget|null,
    viewport: {
        x: number,
        y: number,
        width: number,
        height: number
    },
    clearColor?: {
        r: number,
        g: number,
        b: number,
        a?: number,
    },
    clearDepth?: number,
    commandList: IRenderCommand[]
}


export function RenderComponent(entityManager:EntityManager) {
    entityManager.query<IRenderTarget>([RenderTags.RENDERTARGET]).subscribeAdded(entity => {
        entity.add(ResourceTags.RESOURCE).add(RenderTags.PENDING_GPU_UPLOAD).set<IRenderTarget>({
            width: 0,
            height: 0
        }, false)
    });

    entityManager.query<IOffscreenRenderTarget>([RenderTags.OFFSCREEN_RENDERTARGET]).subscribeAdded(entity => {
        entity.add(RenderTags.RENDERTARGET).add(RenderTags.PENDING_GPU_UPLOAD).set<IOffscreenRenderTarget>({
            textures: []
        }, false)
    });

    entityManager.query<ICanvasRenderTarget>([RenderTags.CANVAS_RENDERTARGET]).subscribeAdded(entity => {
        entity.add(RenderTags.RENDERTARGET).add(RenderTags.PENDING_GPU_UPLOAD).set<ICanvasRenderTarget>({
            canvas: null
        }, false)
    });

    entityManager.query<IMesh>([RenderTags.MESH]).subscribeAdded(entity => {
        entity.add(ResourceTags.RESOURCE).add(RenderTags.PENDING_GPU_UPLOAD).set<IMesh>({
            vertexStreams: [],
            indices: null
        }, false)
    });

    entityManager.query<ITexture>([RenderTags.TEXTURE]).subscribeAdded(entity => {
        entity.add(ResourceTags.RESOURCE).add(RenderTags.PENDING_GPU_UPLOAD).set<ITexture>({
            width: 0,
            height: 0,
            format: WebGLRenderingContext.RGBA,
            layers: []
        }, false)
    });

    entityManager.query<IShader>([RenderTags.SHADER]).subscribeAdded(entity => {
        entity.add(ResourceTags.RESOURCE).add(RenderTags.PENDING_GPU_UPLOAD).set<IShader>({
            vertexSource: "",
            pixelSource: ""
        }, false)
    });

    entityManager.query<IRenderList>([RenderTags.RENDER_LIST]).subscribeAdded(entity => {
        entity.set<IRenderList>({
            renderTarget: null,
            viewport: {
                x: 0,
                y: 0,
                width: 1,
                height: 1
            },
            clearColor: {
                r: 0,
                g: 0,
                b: 0,
                a: 1,
            },
            clearDepth: 1.0,
            commandList: []
        }, false)
    });
}
