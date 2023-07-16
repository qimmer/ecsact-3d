import {ITickable} from "@src/ITickable";
import {assert, assertValue, EntityManager, IEntityQuery} from "ecsact";
import {IRenderingContext, PlatformTags} from "@components/Platform";
import {
    ICanvasRenderTarget,
    IMesh,
    IOffscreenRenderTarget,
    IRenderList,
    IRenderTarget,
    IShader,
    ITexture,
    RenderTags
} from "@components/Render";
import {IWebGLFrameBuffer, IWebGLMesh, IWebGLShader, IWebGLTexture} from "@components/WebGL";
import {isPowerOf2} from "@src/Utils/Math";
import {getVertexCount} from "@src/Utils/MeshUtils";
import {ResourceTags} from "@components/Resource";
import {Service} from "typedi";

@Service()
export class WebGLRenderSystem implements ITickable {
    private readonly renderListQuery: IEntityQuery<IRenderList>;
    private readonly uploadTexturesQuery: IEntityQuery<IWebGLTexture>;
    private readonly uploadMeshQuery: IEntityQuery<IWebGLMesh>;
    private readonly uploadShaderQuery: IEntityQuery<IWebGLShader>;
    private entityManager: EntityManager;
    private canvasRenderTargetQuery: IEntityQuery<ICanvasRenderTarget>;
    private renderingContextQuery: IEntityQuery<IRenderingContext>;
    private offscreenRenderTargetQuery: IEntityQuery<IOffscreenRenderTarget>;
    private uploadFramebuffersQuery: IEntityQuery<IWebGLFrameBuffer>;

    constructor(entityManager:EntityManager) {
        this.renderingContextQuery = entityManager.query([PlatformTags.RENDERING_CONTEXT]);
        this.canvasRenderTargetQuery = entityManager.query([RenderTags.CANVAS_RENDERTARGET]);
        this.offscreenRenderTargetQuery = entityManager.query([RenderTags.OFFSCREEN_RENDERTARGET]);
        this.renderListQuery = entityManager.query([RenderTags.RENDER_LIST]);
        this.uploadShaderQuery = entityManager.query([RenderTags.SHADER, RenderTags.PENDING_GPU_UPLOAD, '!' + ResourceTags.PENDING_DOWNLOAD, "!" + ResourceTags.DOWNLOADING]);
        this.uploadMeshQuery = entityManager.query([RenderTags.MESH, RenderTags.PENDING_GPU_UPLOAD, '!' + ResourceTags.PENDING_DOWNLOAD, "!" + ResourceTags.DOWNLOADING]);
        this.uploadTexturesQuery = entityManager.query([RenderTags.TEXTURE, RenderTags.PENDING_GPU_UPLOAD, '!' + ResourceTags.PENDING_DOWNLOAD, "!" + ResourceTags.DOWNLOADING]);
        this.uploadFramebuffersQuery = entityManager.query([RenderTags.OFFSCREEN_RENDERTARGET, RenderTags.PENDING_GPU_UPLOAD]);
        this.entityManager = entityManager;
    }

    tick(deltaTime: number): void {
        this.renderingContextQuery.forEach(context => {
            let gl = context.gl,
                canvas = context.canvas,
                lastTarget:IRenderTarget|null = null,
                lastMesh:IMesh|null = null,
                lastShader:IShader|null = null,
                lastTextures = <Array<ITexture|null>>[
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                ];

            if(!gl) {
                return;
            }

            this.canvasRenderTargetQuery.forEach(rt => {
                rt.width = rt.canvas?.width || 0;
                rt.height = rt.canvas?.height || 0;
            });

            this.offscreenRenderTargetQuery.forEach(rt => {
                if(rt.textures[0]) {
                    if(rt.textures[0].width !== rt.width || rt.textures[0].height !== rt.height) {
                        rt.width = rt.textures[0]?.width || 0;
                        rt.height = rt.textures[0]?.height || 0;

                        rt.add(RenderTags.PENDING_GPU_UPLOAD).apply();
                    }
                }
            });

            this.uploadShaderQuery.forEach(shader => {
                let handle = shader.handle || assertValue(gl.createProgram(), "Could not create WebGL program handler"),
                    vertexShader = WebGLRenderSystem.compileShader(gl, gl.VERTEX_SHADER, shader.vertexSource),
                    pixelShader = WebGLRenderSystem.compileShader(gl, gl.FRAGMENT_SHADER, shader.pixelSource),
                    attributeLocations = {} as Record<string, number>,
                    uniformLocations = {} as Record<string, WebGLUniformLocation>,
                    uniformSetters = {} as Record<string, (value:number|number[]|Float32Array)=>void>;

                gl.attachShader(handle, vertexShader);
                gl.attachShader(handle, pixelShader);
                gl.linkProgram(handle);

                // If creating the shader program failed, alert
                if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
                    throw new Error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(handle));
                }

                for (let i = 0; i < gl.getProgramParameter(handle, gl.ACTIVE_ATTRIBUTES); ++i) {
                    let name = gl.getActiveAttrib(handle, i)?.name || '';
                    attributeLocations[name] = gl.getAttribLocation(handle, name);
                }

                for (let i = 0; i < gl.getProgramParameter(handle, gl.ACTIVE_UNIFORMS); ++i) {
                    let activeUniform = assertValue(gl.getActiveUniform(handle, i), 'Could not get active uniform.'),
                        name = activeUniform.name,
                        type = activeUniform.type,
                        location = assertValue(gl.getUniformLocation(handle, name), 'Could not get uniform location.');

                    uniformLocations[name] = location;

                    switch(type) {
                        case gl.FLOAT:
                            uniformSetters[name] = function(value:number|number[]|Float32Array):void { gl.uniform1f(location, value as number); };
                            break;
                        case gl.FLOAT_VEC2:
                            uniformSetters[name] = function(value:number|number[]|Float32Array):void { gl.uniform2fv(location, value as Float32Array); };
                            break;
                        case gl.FLOAT_VEC3:
                            uniformSetters[name] = function(value:number|number[]|Float32Array):void { gl.uniform3fv(location, value as Float32Array); };
                            break;
                        case gl.FLOAT_VEC4:
                            uniformSetters[name] = function(value:number|number[]|Float32Array):void { gl.uniform4fv(location, value as Float32Array); };
                            break;
                        case gl.FLOAT_MAT2:
                            uniformSetters[name] = function(value:number|number[]|Float32Array):void { gl.uniformMatrix2fv(location, false, value as Float32Array); };
                            break;
                        case gl.FLOAT_MAT3:
                            uniformSetters[name] = function(value:number|number[]|Float32Array):void { gl.uniformMatrix3fv(location, false, value as Float32Array); };
                            break;
                        case gl.FLOAT_MAT4:
                            uniformSetters[name] = function(value:number|number[]|Float32Array):void { gl.uniformMatrix4fv(location, false, value as Float32Array); };
                            break;
                        case gl.SAMPLER_2D:
                            uniformSetters[name] = function(value:number|number[]|Float32Array):void { gl.uniform1i(location, value as number); };
                            break;
                    }
                }

                shader.handle = handle;
                shader.uniformSetters = uniformSetters;
                shader.attributeLocations = attributeLocations;
                shader.uniformLocations = uniformLocations;

                shader.remove(RenderTags.PENDING_GPU_UPLOAD);
            });

            this.uploadMeshQuery.forEach(mesh => {
                mesh.vbos = mesh.vertexStreams.map((stream, index) => {
                    let handle = (mesh.vbos ? mesh.vbos[index] : null) || assertValue(gl.createBuffer(), 'Could not create vertex buffer.');
                    if(stream.data) {
                        gl.bindBuffer(gl.ARRAY_BUFFER, handle);
                        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(stream.data), gl.STATIC_DRAW);
                    }
                    return handle;
                });

                if(mesh.indices) {
                    let handle = mesh.ibo || assertValue(gl.createBuffer(), 'Could not create index buffer.');
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, handle);
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
                    mesh.ibo = handle;
                }

                mesh.remove(RenderTags.PENDING_GPU_UPLOAD);
            });

            this.uploadTexturesQuery.forEach(texture => {
                let handle = texture.handle || assertValue(gl.createTexture(), "Could not create texture");

                gl.bindTexture(gl.TEXTURE_2D, handle);

                texture.layers.forEach((layer, index) => {
                    if(layer instanceof HTMLImageElement) {
                        gl.texImage2D(gl.TEXTURE_2D, index, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer);
                    } else if(layer instanceof Uint8Array) {
                        gl.texImage2D(gl.TEXTURE_2D, index, gl.RGBA, texture.width, texture.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, layer);
                    } else {
                        gl.texImage2D(gl.TEXTURE_2D, index, gl.RGBA, texture.width, texture.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
                    }
                });

                // WebGL1 has different requirements for power of 2 images
                // vs non power of 2 images so check if the image is a
                // power of 2 in both dimensions.
                if (texture.width > 0 && texture.height > 0 && isPowerOf2(texture.width) && isPowerOf2(texture.height) && !!texture.layers[0]) {
                    // Yes, it's a power of 2. Generate mips.
                    gl.generateMipmap(gl.TEXTURE_2D);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                } else {
                    // No, it's not a power of 2. Turn off mips and set
                    // wrapping to clamp to edge
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                }

                texture.handle = handle;

                texture.remove(RenderTags.PENDING_GPU_UPLOAD);
            });

            this.uploadFramebuffersQuery.forEach(frameBuffer => {
                let handle = frameBuffer.handle || assertValue(gl.createFramebuffer(), "Could not create framebuffer"),
                    depthHandle = frameBuffer.depthHandle || assertValue(gl.createRenderbuffer(), "Could not create depth renderbuffer");

                gl.bindFramebuffer(gl.FRAMEBUFFER, handle);
                gl.bindRenderbuffer(gl.RENDERBUFFER, depthHandle);

                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, frameBuffer.width, frameBuffer.height);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthHandle);

                frameBuffer.textures.forEach((texture, index) => {
                    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + index, gl.TEXTURE_2D, (<IWebGLTexture>texture).handle, 0);
                });

                frameBuffer.handle = handle;

                frameBuffer.remove(RenderTags.PENDING_GPU_UPLOAD);
            });

            this.renderListQuery.forEach(renderList => {
                let clearFlags = 0;

                if(renderList.renderTarget && (<IOffscreenRenderTarget>renderList.renderTarget).textures) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, (<IOffscreenRenderTarget&IWebGLFrameBuffer>renderList.renderTarget).handle);
                } else {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                }

                gl.viewport(
                    renderList.viewport.x * (renderList.renderTarget ? renderList.renderTarget.width : gl.drawingBufferWidth),
                    renderList.viewport.y * (renderList.renderTarget ? renderList.renderTarget.height : gl.drawingBufferHeight),
                    renderList.viewport.width * (renderList.renderTarget ? renderList.renderTarget.width : gl.drawingBufferWidth),
                    renderList.viewport.height * (renderList.renderTarget ? renderList.renderTarget.height : gl.drawingBufferHeight)
                );
                gl.disable(gl.SCISSOR_TEST);
                gl.enable(gl.CULL_FACE);

                gl.cullFace(gl.FRONT);

                if(renderList.clearColor) {
                    gl.clearColor(renderList.clearColor.r, renderList.clearColor.g, renderList.clearColor.b, (typeof renderList.clearColor.a === 'number') ? renderList.clearColor.a : 1.0);
                    clearFlags |= gl.COLOR_BUFFER_BIT;
                }

                if(typeof renderList.clearDepth === 'number') {
                    gl.clearDepth(renderList.clearDepth);
                    clearFlags |= gl.DEPTH_BUFFER_BIT;
                }

                gl.clear(clearFlags);

                renderList.commandList.forEach(command => {
                    let samplerIndex = 0,
                        shader = (command.shader as IWebGLShader),
                        mesh = (command.mesh as IWebGLMesh);

                    if(!shader.handle || !mesh.vbos || mesh.vbos.length !== mesh.vertexStreams.length) {
                        return;
                    }

                    if(command.blend) {
                        gl.enable(gl.BLEND);
                        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                    } else {
                        gl.disable(gl.BLEND);
                    }

                    if(command.depthTest === undefined) {
                        gl.enable(gl.DEPTH_TEST);
                        gl.depthFunc(gl.LESS);
                    } else {
                        switch(command.depthTest) {
                            case 0:
                                gl.disable(gl.DEPTH_TEST);
                                break;
                            default:
                                gl.enable(gl.DEPTH_TEST);
                                gl.depthFunc(command.depthTest);
                        }
                    }

                    if (command.shader !== lastShader) {
                        gl.useProgram((command.shader as IWebGLShader).handle);
                        lastShader = command.shader;
                    }

                    if (command.mesh !== lastMesh) {
                        this.bindMesh(gl, mesh, shader);
                        lastMesh = command.mesh;
                    }

                    for(let sampler in command.textures) {
                        const commandTexture = command.textures[sampler] as IWebGLTexture,
                            lastTexture = lastTextures[samplerIndex];

                        if(!commandTexture.handle) {
                            return;
                        }

                        shader.uniformSetters[sampler](samplerIndex);

                        if (commandTexture !== lastTexture) {
                            this.bindTexture(gl, samplerIndex, commandTexture);
                            lastTextures[samplerIndex] = commandTexture;
                        }

                        lastTextures[samplerIndex] = commandTexture;
                        samplerIndex++;
                    }

                    for(let name in shader.uniformSetters) {
                        if(command.textures[name] !== undefined) {
                            continue;
                        }

                        let uniformValue = command.uniforms[name];
                        assert(typeof uniformValue === 'number' || uniformValue?.length > 0, "Uniform required by shader not set: " + name);

                        shader.uniformSetters[name](uniformValue);
                    }

                    if(mesh.ibo) {
                        let indexCount = command.count || mesh.indices?.length || 0;
                        if(indexCount > 0) {
                            gl.drawElements(command.mesh.primitiveType || gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, command.offset || 0);
                        }
                    } else {
                        let vertexCount = command.count || getVertexCount(mesh);
                        if(vertexCount > 0) {
                            gl.drawArrays(command.mesh.primitiveType || gl.TRIANGLES, command.offset || 0, vertexCount * 2);
                        }
                    }
                });

                renderList.commandList = [];
            });
        });
    }

    private bindMesh(gl:WebGLRenderingContext, mesh:IWebGLMesh, program:IWebGLShader):void {
        for(let i = 0; i < 8; ++i) {
            gl.disableVertexAttribArray(i);
        }
        mesh.vertexStreams.forEach((stream, i) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbos[i]);

            stream.attributes.forEach(attribute => {
                let attributeName = attribute.name,
                    attributeLocation = program.attributeLocations[attributeName];

                if(attributeLocation !== undefined) {

                    gl.vertexAttribPointer(
                        program.attributeLocations[attributeName],
                        attribute.count,
                        attribute.type,
                        attribute.normalize || false,
                        attribute.stride || 0,
                        attribute.offset || 0
                    );

                    gl.enableVertexAttribArray(program.attributeLocations[attributeName]);

                }
            });
        });

        if(mesh.indices) {
            let indexHandle = mesh.ibo;

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexHandle);
        } else {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }
    }

    private bindTexture(gl:WebGLRenderingContext, stage:number, texture:IWebGLTexture|null):void {
        gl.activeTexture(gl.TEXTURE0 + stage);

        if (!texture) {
            gl.bindTexture(gl.TEXTURE_2D, null);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, texture.handle);
        }
    }

    private static compileShader(gl:WebGLRenderingContext, type:GLenum, source:string):WebGLShader {
        const shader = gl.createShader(type);
        if(!shader) {
            throw new Error("Could not create shader handle");
        }

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        // See if it compiled successfully
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            let log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error('An error occurred compiling shader: ' + log);
        }

        return shader;
    }
}
