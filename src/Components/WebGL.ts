import {IMesh, IOffscreenRenderTarget, IShader, ITexture} from "./Render";

export interface IWebGLShader extends IShader {
    handle:WebGLProgram;
    attributeLocations: Record<string, number>,
    uniformLocations: Record<string, WebGLUniformLocation>,
    uniformSetters: Record<string, (value:number|number[]|Float32Array)=>void>
}
export interface IWebGLMesh extends IMesh {
    vbos:WebGLBuffer[];
    ibo:WebGLBuffer|null
    vaoHandle : WebGLVertexArrayObject|null,
}
export interface IWebGLTexture extends ITexture {
    handle:WebGLTexture;
}

export interface IWebGLFrameBuffer extends IOffscreenRenderTarget {
    handle:WebGLFramebuffer;
    depthHandle:WebGLRenderbuffer;
}
