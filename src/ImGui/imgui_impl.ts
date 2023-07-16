import * as ImGui from "./imgui";

let clipboard_text: string = "";

let canvas: HTMLCanvasElement | null = null;

export let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
let gl_vao: OES_vertex_array_object | null = null;
let vertex_array_object: WebGLVertexArrayObject | WebGLVertexArrayObjectOES | null;
let g_ShaderHandle: WebGLProgram | null = null;
let g_VertHandle: WebGLShader | null = null;
let g_FragHandle: WebGLShader | null = null;
let g_AttribLocationTex: WebGLUniformLocation | null = null;
let g_AttribLocationProjMtx: WebGLUniformLocation | null = null;
let g_AttribLocationPosition: GLint = -1;
let g_AttribLocationUV: GLint = -1;
let g_AttribLocationColor: GLint = -1;
let g_VboHandle: WebGLBuffer | null = null;
let g_ElementsHandle: WebGLBuffer | null = null;
let g_FontTexture: WebGLTexture | null = null;

export let ctx: CanvasRenderingContext2D | null = null;

let prev_time: number = 0;

function document_on_copy(event: ClipboardEvent): void {
    if (event.clipboardData) {
        event.clipboardData.setData("text/plain", clipboard_text);
    }
    // console.log(`${event.type}: "${clipboard_text}"`);
    event.preventDefault();
}

function document_on_cut(event: ClipboardEvent): void {
    if (event.clipboardData) {
        event.clipboardData.setData("text/plain", clipboard_text);
    }
    // console.log(`${event.type}: "${clipboard_text}"`);
    event.preventDefault();
}

function document_on_paste(event: ClipboardEvent): void {
    if (event.clipboardData) {
        clipboard_text = event.clipboardData.getData("text/plain");
    }
    // console.log(`${event.type}: "${clipboard_text}"`);
    event.preventDefault();
}

function window_on_resize(): void {
    if (canvas !== null) {
        canvas.width = canvas.scrollWidth;
        canvas.height = canvas.scrollHeight;
    }
}

function window_on_gamepadconnected(event: any /* GamepadEvent */): void {
    console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
    event.gamepad.index, event.gamepad.id,
    event.gamepad.buttons.length, event.gamepad.axes.length);
}

function window_on_gamepaddisconnected(event: any /* GamepadEvent */): void {
    console.log("Gamepad disconnected at index %d: %s.",
    event.gamepad.index, event.gamepad.id);
}

function canvas_on_blur(event: FocusEvent): void {
    console.log(event.type);

    const io = ImGui.GetIO();
    io.KeyCtrl = false;
    io.KeyShift = false;
    io.KeyAlt = false;
    io.KeySuper = false;
    for (let i = 0; i < io.KeysDown.length; ++i) {
        io.KeysDown[i] = false;
    }
    for (let i = 0; i < io.MouseDown.length; ++i) {
        io.MouseDown[i] = false;
    }
}

const key_code_to_index: Record<string, number> = {
    "NumpadEnter": 176,
};

function canvas_on_keydown(event: KeyboardEvent): void {
    const io = ImGui.GetIO();
    io.KeyCtrl = event.ctrlKey;
    io.KeyShift = event.shiftKey;
    io.KeyAlt = event.altKey;
    io.KeySuper = event.metaKey;
    const key_index: number = key_code_to_index[event.code] || event.keyCode;
    ImGui.ASSERT(key_index >= 0 && key_index < ImGui.ARRAYSIZE(io.KeysDown));
    io.KeysDown[key_index] = true;
    // forward to the keypress event
    if (io.WantCaptureKeyboard || event.key === "Tab" ) {
        //event.preventDefault();
    }

    if(event.key === "Tab") {
        event.preventDefault()
    }
}

function canvas_on_keyup(event: KeyboardEvent): void  {
    const io = ImGui.GetIO();
    io.KeyCtrl = event.ctrlKey;
    io.KeyShift = event.shiftKey;
    io.KeyAlt = event.altKey;
    io.KeySuper = event.metaKey;
    const key_index: number = key_code_to_index[event.code] || event.keyCode;
    ImGui.ASSERT(key_index >= 0 && key_index < ImGui.ARRAYSIZE(io.KeysDown));
    io.KeysDown[key_index] = false;
    if (io.WantCaptureKeyboard) {
        //event.preventDefault();
    }
}

function canvas_on_keypress(event: KeyboardEvent): void  {
    const io = ImGui.GetIO();
    io.AddInputCharacter(event.charCode);
    if (io.WantCaptureKeyboard) {
        event.preventDefault();
    }
}

function canvas_on_pointermove(event: PointerEvent): void  {
    const io = ImGui.GetIO();
    io.MousePos.x = event.offsetX;
    io.MousePos.y = event.offsetY;
    if (io.WantCaptureMouse) {
        event.preventDefault();
    }
}

// MouseEvent.button
// A number representing a given button:
// 0: Main button pressed, usually the left button or the un-initialized state
// 1: Auxiliary button pressed, usually the wheel button or the middle button (if present)
// 2: Secondary button pressed, usually the right button
// 3: Fourth button, typically the Browser Back button
// 4: Fifth button, typically the Browser Forward button
const mouse_button_map: number[] = [ 0, 2, 1, 3, 4 ];

function canvas_on_pointerdown(event: PointerEvent): void  {
    const io = ImGui.GetIO();
    io.MousePos.x = event.offsetX;
    io.MousePos.y = event.offsetY;
    io.MouseDown[mouse_button_map[event.button]] = true;
    if (io.WantCaptureMouse) {
         event.preventDefault();
    }
}
function canvas_on_contextmenu(event: Event): void  {
    const io = ImGui.GetIO();
    if (io.WantCaptureMouse) {
        event.preventDefault();
    }
}

function canvas_on_pointerup(event: PointerEvent): void  {
    const io = ImGui.GetIO();
    io.MousePos.x = event.offsetX;
    io.MousePos.y = event.offsetY;
    io.MouseDown[mouse_button_map[event.button]] = false;
    if (io.WantCaptureMouse) {
        event.preventDefault();
    }
}

function canvas_on_wheel(event: WheelEvent): void  {
    const io = ImGui.GetIO();
    let scale: number = 1.0;
    switch (event.deltaMode) {
        case event.DOM_DELTA_PIXEL: scale = 0.01; break;
        case event.DOM_DELTA_LINE: scale = 0.2; break;
        case event.DOM_DELTA_PAGE: scale = 1.0; break;
    }
    io.MouseWheelH = event.deltaX * scale;
    io.MouseWheel = -event.deltaY * scale; // Mouse wheel: 1 unit scrolls about 5 lines text.
    if (io.WantCaptureMouse) {
        event.preventDefault();
    }
}

export function Init(value: HTMLCanvasElement | WebGL2RenderingContext | WebGLRenderingContext | CanvasRenderingContext2D | null): void {
    const io = ImGui.GetIO();

    if (typeof(window) !== "undefined") {
        io.BackendPlatformName = "imgui_impl_browser";
        ImGui.LoadIniSettingsFromMemory(window.localStorage.getItem("imgui.ini") || "");
    }
    else {
        io.BackendPlatformName = "imgui_impl_console";
    }

    if (typeof(navigator) !== "undefined") {
        io.ConfigMacOSXBehaviors = navigator.platform.match(/Mac/) !== null;
    }

    if (typeof(document) !== "undefined") {
        document.body.addEventListener("copy", document_on_copy);
        document.body.addEventListener("cut", document_on_cut);
        document.body.addEventListener("paste", document_on_paste);
    }

    io.SetClipboardTextFn = (user_data: any, text: string): void => {
        clipboard_text = text;
        // console.log(`set clipboard_text: "${clipboard_text}"`);
        if (typeof navigator !== "undefined" && typeof (navigator as any).clipboard !== "undefined") {
            // console.log(`clipboard.writeText: "${clipboard_text}"`);
            (navigator as any).clipboard.writeText(clipboard_text).then((): void => {
                // console.log(`clipboard.writeText: "${clipboard_text}" done.`);
            });
        }
    };
    io.GetClipboardTextFn = (user_data: any): string => {
        // if (typeof navigator !== "undefined" && typeof (navigator as any).clipboard !== "undefined") {
        //     console.log(`clipboard.readText: "${clipboard_text}"`);
        //     (navigator as any).clipboard.readText().then((text: string): void => {
        //         clipboard_text = text;
        //         console.log(`clipboard.readText: "${clipboard_text}" done.`);
        //     });
        // }
        // console.log(`get clipboard_text: "${clipboard_text}"`);
        return clipboard_text;
    };
    io.ClipboardUserData = null;
    io.MouseDoubleClickTime = 1.0;

    if (typeof(window) !== "undefined") {
        window.addEventListener("resize", window_on_resize);
        window.addEventListener("gamepadconnected", window_on_gamepadconnected);
        window.addEventListener("gamepaddisconnected", window_on_gamepaddisconnected);
    }

    if (typeof(window) !== "undefined") {
        if (value instanceof(HTMLCanvasElement)) {
            canvas = value;
            value = canvas.getContext("webgl2", { alpha: false }) || canvas.getContext("webgl", { alpha: false }) || canvas.getContext("2d");
        }
        if (typeof WebGL2RenderingContext !== "undefined" && value instanceof(WebGL2RenderingContext)) {
            io.BackendRendererName = "imgui_impl_webgl2";
            canvas = canvas || value.canvas as HTMLCanvasElement;
            gl = value;
        }
        else if (typeof WebGLRenderingContext !== "undefined" && value instanceof(WebGLRenderingContext)) {
            io.BackendRendererName = "imgui_impl_webgl";
            canvas = canvas || value.canvas as HTMLCanvasElement;
            gl = value;

            gl_vao = gl?.getExtension('OES_vertex_array_object');
        }
        else if (typeof CanvasRenderingContext2D !== "undefined" && value instanceof(CanvasRenderingContext2D)) {
            io.BackendRendererName = "imgui_impl_2d";
            canvas = canvas || value.canvas;
            ctx = value;
        }

        const gl2: WebGL2RenderingContext | null = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext && gl || null;

        vertex_array_object = (gl2 ? gl2.createVertexArray() : (gl_vao?.createVertexArrayOES() || null));

    }

    if (canvas !== null) {
        window_on_resize();
        canvas.style.touchAction = "none"; // Disable browser handling of all panning and zooming gestures.
        window.addEventListener("blur", canvas_on_blur);
        window.addEventListener("keydown", canvas_on_keydown);
        window.addEventListener("keyup", canvas_on_keyup);
        window.addEventListener("keypress", canvas_on_keypress);
        canvas.addEventListener("pointermove", canvas_on_pointermove);
        canvas.addEventListener("pointerdown", canvas_on_pointerdown);
        canvas.addEventListener("contextmenu", canvas_on_contextmenu);
        canvas.addEventListener("pointerup", canvas_on_pointerup);
        canvas.addEventListener("wheel", canvas_on_wheel);
    }

    // Setup back-end capabilities flags
    io.BackendFlags |= ImGui.BackendFlags.HasMouseCursors;   // We can honor GetMouseCursor() values (optional)

    // Keyboard mapping. ImGui will use those indices to peek into the io.KeyDown[] array.
    io.KeyMap[ImGui.Key.Tab] = 9;
    io.KeyMap[ImGui.Key.LeftArrow] = 37;
    io.KeyMap[ImGui.Key.RightArrow] = 39;
    io.KeyMap[ImGui.Key.UpArrow] = 38;
    io.KeyMap[ImGui.Key.DownArrow] = 40;
    io.KeyMap[ImGui.Key.PageUp] = 33;
    io.KeyMap[ImGui.Key.PageDown] = 34;
    io.KeyMap[ImGui.Key.Home] = 36;
    io.KeyMap[ImGui.Key.End] = 35;
    io.KeyMap[ImGui.Key.Insert] = 45;
    io.KeyMap[ImGui.Key.Delete] = 46;
    io.KeyMap[ImGui.Key.Backspace] = 8;
    io.KeyMap[ImGui.Key.Space] = 32;
    io.KeyMap[ImGui.Key.Enter] = 13;
    io.KeyMap[ImGui.Key.Escape] = 27;
    io.KeyMap[ImGui.Key.KeyPadEnter] = key_code_to_index["NumpadEnter"];
    io.KeyMap[ImGui.Key.A] = 65;
    io.KeyMap[ImGui.Key.C] = 67;
    io.KeyMap[ImGui.Key.V] = 86;
    io.KeyMap[ImGui.Key.X] = 88;
    io.KeyMap[ImGui.Key.Y] = 89;
    io.KeyMap[ImGui.Key.Z] = 90;

    CreateDeviceObjects();
}

export function Shutdown(): void {
    DestroyDeviceObjects();

    if (canvas !== null) {
        window.removeEventListener("blur", canvas_on_blur);
        window.removeEventListener("keydown", canvas_on_keydown);
        window.removeEventListener("keyup", canvas_on_keyup);
        window.removeEventListener("keypress", canvas_on_keypress);
        canvas.removeEventListener("pointermove", canvas_on_pointermove);
        canvas.removeEventListener("pointerdown", canvas_on_pointerdown);
        canvas.removeEventListener("contextmenu", canvas_on_contextmenu);
        canvas.removeEventListener("pointerup", canvas_on_pointerup);
        canvas.removeEventListener("wheel", canvas_on_wheel);
    }

    gl = null;
    ctx = null;
    canvas = null;

    if (typeof(window) !== "undefined") {
        window.removeEventListener("resize", window_on_resize);
        window.removeEventListener("gamepadconnected", window_on_gamepadconnected);
        window.removeEventListener("gamepaddisconnected", window_on_gamepaddisconnected);
    }

    if (typeof(document) !== "undefined") {
        document.body.removeEventListener("copy", document_on_copy);
        document.body.removeEventListener("cut", document_on_cut);
        document.body.removeEventListener("paste", document_on_paste);
    }
}

export function NewFrame(dt: number): void {
    const io = ImGui.GetIO();

    if (io.WantSaveIniSettings) {
        io.WantSaveIniSettings = false;
        if (typeof(window) !== "undefined") {
            window.localStorage.setItem("imgui.ini", ImGui.SaveIniSettingsToMemory());
        }
    }

    const w: number = canvas && canvas.scrollWidth || 640;
    const h: number = canvas && canvas.scrollHeight || 480;
    const display_w: number = gl && gl.drawingBufferWidth || w;
    const display_h: number = gl && gl.drawingBufferHeight || h;
    io.DisplaySize.x = w;
    io.DisplaySize.y = h;
    io.DisplayFramebufferScale.x = w > 0 ? (display_w / w) : 0;
    io.DisplayFramebufferScale.y = h > 0 ? (display_h / h) : 0;

    io.DeltaTime = dt;

    if (io.WantSetMousePos) {
        console.log("TODO: MousePos", io.MousePos.x, io.MousePos.y);
    }

    if (typeof(document) !== "undefined") {
        if (io.MouseDrawCursor) {
            document.body.style.cursor = "none";
        } else {
            switch (ImGui.GetMouseCursor()) {
                case ImGui.MouseCursor.None: document.body.style.cursor = "none"; break;
                default: case ImGui.MouseCursor.Arrow: document.body.style.cursor = "default"; break;
                case ImGui.MouseCursor.TextInput: document.body.style.cursor = "text"; break;         // When hovering over InputText, etc.
                case ImGui.MouseCursor.ResizeAll: document.body.style.cursor = "all-scroll"; break;         // Unused
                case ImGui.MouseCursor.ResizeNS: document.body.style.cursor = "ns-resize"; break;     // When hovering over an horizontal border
                case ImGui.MouseCursor.ResizeEW: document.body.style.cursor = "ew-resize"; break;     // When hovering over a vertical border or a column
                case ImGui.MouseCursor.ResizeNESW: document.body.style.cursor = "nesw-resize"; break; // When hovering over the bottom-left corner of a window
                case ImGui.MouseCursor.ResizeNWSE: document.body.style.cursor = "nwse-resize"; break; // When hovering over the bottom-right corner of a window
                case ImGui.MouseCursor.Hand: document.body.style.cursor = "grab"; break;
                case ImGui.MouseCursor.NotAllowed: document.body.style.cursor = "not-allowed"; break;
            }
        }
    }

    // Gamepad navigation mapping [BETA]
    for (let i = 0; i < io.NavInputs.length; ++i) {
        // TODO: This is currently causing an issue and I have no gamepad to test with.
        //       The error is: ''set' on proxy: trap returned falsish for property '21'
        //       I think that the NavInputs are zeroed out by ImGui at the start of each frame anyway
        //       so I am not sure if the following is even necessary.
        //io.NavInputs[i] = 0.0;
    }
}

export function RenderDrawData(draw_data: ImGui.DrawData | null = ImGui.GetDrawData()): void {
    const io = ImGui.GetIO();
    if (draw_data === null) { throw new Error(); }

    gl || ctx || console.log(draw_data);

    // Avoid rendering when minimized, scale coordinates for retina displays (screen coordinates != framebuffer coordinates)
    const fb_width: number = io.DisplaySize.x * io.DisplayFramebufferScale.x;
    const fb_height: number = io.DisplaySize.y * io.DisplayFramebufferScale.y;
    if (fb_width === 0 || fb_height === 0) {
        return;
    }
    draw_data.ScaleClipRects(io.DisplayFramebufferScale);

    const gl2: WebGL2RenderingContext | null = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext && gl || null;

    // Setup desired GL state
    // Recreate the VAO every time (this is to easily allow multiple GL contexts to be rendered to. VAO are not shared among GL contexts)
    // The renderer would actually work without any VAO bound, but then our VertexAttrib calls would overwrite the default one currently bound.

    // Setup render state: alpha-blending enabled, no face culling, no depth testing, scissor enabled, polygon fill
    gl && gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl && gl.enable(gl.BLEND);
    gl && gl.blendEquation(gl.FUNC_ADD);
    gl && gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl && gl.disable(gl.CULL_FACE);
    gl && gl.disable(gl.DEPTH_TEST);
    gl && gl.enable(gl.SCISSOR_TEST);
    // glPolygonMode(GL_FRONT_AND_BACK, GL_FILL);

    // Setup viewport, orthographic projection matrix
    // Our visible imgui space lies from draw_data->DisplayPps (top left) to draw_data->DisplayPos+data_data->DisplaySize (bottom right). DisplayMin is typically (0,0) for single viewport apps.
    gl && gl.viewport(0, 0, fb_width, fb_height);
    const L: number = draw_data.DisplayPos.x;
    const R: number = draw_data.DisplayPos.x + draw_data.DisplaySize.x;
    const T: number = draw_data.DisplayPos.y;
    const B: number = draw_data.DisplayPos.y + draw_data.DisplaySize.y;
    const ortho_projection: Float32Array = new Float32Array([
        2.0 / (R - L),     0.0,                0.0, 0.0,
        0.0,               2.0 / (T - B),      0.0, 0.0,
        0.0,               0.0,               -1.0, 0.0,
        (R + L) / (L - R), (T + B) / (B - T),  0.0, 1.0,
    ]);
    gl && gl.useProgram(g_ShaderHandle);
    gl && gl.uniform1i(g_AttribLocationTex, 0);
    gl && g_AttribLocationProjMtx && gl.uniformMatrix4fv(g_AttribLocationProjMtx, false, ortho_projection);

    gl2 && gl2.bindVertexArray(vertex_array_object) || gl_vao && gl_vao.bindVertexArrayOES(vertex_array_object);

    // Render command lists
    gl && gl.bindBuffer(gl.ARRAY_BUFFER, g_VboHandle);
    gl && gl.enableVertexAttribArray(g_AttribLocationPosition);
    gl && gl.enableVertexAttribArray(g_AttribLocationUV);
    gl && gl.enableVertexAttribArray(g_AttribLocationColor);

    gl && gl.vertexAttribPointer(g_AttribLocationPosition, 2, gl.FLOAT, false, ImGui.DrawVertSize, ImGui.DrawVertPosOffset);
    gl && gl.vertexAttribPointer(g_AttribLocationUV, 2, gl.FLOAT, false, ImGui.DrawVertSize, ImGui.DrawVertUVOffset);
    gl && gl.vertexAttribPointer(g_AttribLocationColor, 4, gl.UNSIGNED_BYTE, true, ImGui.DrawVertSize, ImGui.DrawVertColOffset);

    // Draw
    const pos = draw_data.DisplayPos;
    const idx_buffer_type: GLenum = gl && ((ImGui.DrawIdxSize === 4) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT) || 0;
    draw_data.IterateDrawLists((draw_list: ImGui.DrawList): void => {
        gl || ctx || console.log(draw_list);
        gl || ctx || console.log("VtxBuffer.length", draw_list.VtxBuffer.length);
        gl || ctx || console.log("IdxBuffer.length", draw_list.IdxBuffer.length);

        gl && gl.bindBuffer(gl.ARRAY_BUFFER, g_VboHandle);
        gl && gl.bufferData(gl.ARRAY_BUFFER, draw_list.VtxBuffer, gl.STREAM_DRAW);
        gl && gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g_ElementsHandle);
        gl && gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, draw_list.IdxBuffer, gl.STREAM_DRAW);

        draw_list.IterateDrawCmds((draw_cmd: ImGui.DrawCmd): void => {
            gl || ctx || console.log(draw_cmd);
            gl || ctx || console.log("ElemCount", draw_cmd.ElemCount);
            gl || ctx || console.log("ClipRect", draw_cmd.ClipRect.x, fb_height - draw_cmd.ClipRect.w, draw_cmd.ClipRect.z - draw_cmd.ClipRect.x, draw_cmd.ClipRect.w - draw_cmd.ClipRect.y);
            gl || ctx || console.log("TextureId", draw_cmd.TextureId);
            if (!gl && !ctx) {
                console.log("i: pos.x pos.y uv.x uv.y col");
                for (let i = 0; i < Math.min(3, draw_cmd.ElemCount); ++i) {
                    const view: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i * ImGui.DrawVertSize);
                    console.log(`${i}: ${view.pos[0].toFixed(2)} ${view.pos[1].toFixed(2)} ${view.uv[0].toFixed(5)} ${view.uv[1].toFixed(5)} ${("00000000" + view.col[0].toString(16)).substr(-8)}`);
                }
            }

            if (draw_cmd.UserCallback !== null) {
                // User callback (registered via ImDrawList::AddCallback)
                draw_cmd.UserCallback(draw_list, draw_cmd);
            } else {
                const clip_rect = new ImGui.Vec4(draw_cmd.ClipRect.x - pos.x, draw_cmd.ClipRect.y - pos.y, draw_cmd.ClipRect.z - pos.x, draw_cmd.ClipRect.w - pos.y);
                if (clip_rect.x < fb_width && clip_rect.y < fb_height && clip_rect.z >= 0.0 && clip_rect.w >= 0.0) {
                    // Apply scissor/clipping rectangle
                    gl && gl.scissor(clip_rect.x, fb_height - clip_rect.w, clip_rect.z - clip_rect.x, clip_rect.w - clip_rect.y);

                    // Bind texture, Draw
                    gl && gl.activeTexture(gl.TEXTURE0);
                    gl && gl.bindTexture(gl.TEXTURE_2D, draw_cmd.TextureId);
                    gl && gl.drawElements(gl.TRIANGLES, draw_cmd.ElemCount, idx_buffer_type, draw_cmd.IdxOffset * ImGui.DrawIdxSize);

                    if (ctx) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(clip_rect.x, clip_rect.y, clip_rect.z - clip_rect.x, clip_rect.w - clip_rect.y);
                        ctx.clip();
                        const idx = ImGui.DrawIdxSize === 4 ?
                            new Uint32Array(draw_list.IdxBuffer.buffer, draw_list.IdxBuffer.byteOffset + draw_cmd.IdxOffset * ImGui.DrawIdxSize) :
                            new Uint16Array(draw_list.IdxBuffer.buffer, draw_list.IdxBuffer.byteOffset + draw_cmd.IdxOffset * ImGui.DrawIdxSize);
                        for (let i = 0; i < draw_cmd.ElemCount; i += 3) {
                            const i0: number = idx[i + 0];
                            const i1: number = idx[i + 1];
                            const i2: number = idx[i + 2];
                            const v0: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i0 * ImGui.DrawVertSize);
                            const v1: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i1 * ImGui.DrawVertSize);
                            const v2: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i2 * ImGui.DrawVertSize);
                            const i3: number = idx[i + 3];
                            const i4: number = idx[i + 4];
                            const i5: number = idx[i + 5];
                            const v3: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i3 * ImGui.DrawVertSize);
                            const v4: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i4 * ImGui.DrawVertSize);
                            const v5: ImGui.DrawVert = new ImGui.DrawVert(draw_list.VtxBuffer.buffer, draw_list.VtxBuffer.byteOffset + i5 * ImGui.DrawVertSize);
                            let quad = true;
                            let minmin: ImGui.DrawVert = v0;
                            let minmax: ImGui.DrawVert = v0;
                            let maxmin: ImGui.DrawVert = v0;
                            let maxmax: ImGui.DrawVert = v0;
                            for (const v of [ v1, v2, v3, v4, v5 ]) {
                                let found = false;
                                if (v.pos[0] <= minmin.pos[0] && v.pos[1] <= minmin.pos[1]) { minmin = v; found = true; }
                                if (v.pos[0] <= minmax.pos[0] && v.pos[1] >= minmax.pos[1]) { minmax = v; found = true; }
                                if (v.pos[0] >= maxmin.pos[0] && v.pos[1] <= maxmin.pos[1]) { maxmin = v; found = true; }
                                if (v.pos[0] >= maxmax.pos[0] && v.pos[1] >= maxmax.pos[1]) { maxmax = v; found = true; }
                                if (!found) { quad = false; }
                            }
                            quad = quad && (minmin.pos[0] === minmax.pos[0]);
                            quad = quad && (maxmin.pos[0] === maxmax.pos[0]);
                            quad = quad && (minmin.pos[1] === maxmin.pos[1]);
                            quad = quad && (minmax.pos[1] === maxmax.pos[1]);
                            if (quad) {
                                if (minmin.uv[0] === maxmax.uv[0] || minmin.uv[1] === maxmax.uv[1]) {
                                    // one vertex color
                                    ctx.beginPath();
                                    ctx.rect(minmin.pos[0], minmin.pos[1], maxmax.pos[0] - minmin.pos[0], maxmax.pos[1] - minmin.pos[1]);
                                    ctx.fillStyle = `rgba(${v0.col[0] >> 0 & 0xff}, ${v0.col[0] >> 8 & 0xff}, ${v0.col[0] >> 16 & 0xff}, ${(v0.col[0] >> 24 & 0xff) / 0xff})`;
                                    ctx.fill();
                                } else {
                                    // no vertex color
                                    const image = draw_cmd.TextureId as CanvasImageSource; // HACK
                                    const width = image instanceof HTMLVideoElement ? image.videoWidth : image.width as number;
                                    const height = image instanceof HTMLVideoElement ? image.videoHeight : image.height as number;
                                    image && ctx.drawImage(image,
                                        minmin.uv[0] * width, minmin.uv[1] * height,
                                        (maxmax.uv[0] - minmin.uv[0]) * width, (maxmax.uv[1] - minmin.uv[1]) * height,
                                        minmin.pos[0], minmin.pos[1],
                                        maxmax.pos[0] - minmin.pos[0], maxmax.pos[1] - minmin.pos[1]);
                                    // ctx.beginPath();
                                    // ctx.rect(minmin.pos[0], minmin.pos[1], maxmax.pos[0] - minmin.pos[0], maxmax.pos[1] - minmin.pos[1]);
                                    // ctx.strokeStyle = "yellow";
                                    // ctx.stroke();
                                }
                                i += 3;
                            } else {
                                // one vertex color, no texture
                                ctx.beginPath();
                                ctx.moveTo(v0.pos[0], v0.pos[1]);
                                ctx.lineTo(v1.pos[0], v1.pos[1]);
                                ctx.lineTo(v2.pos[0], v2.pos[1]);
                                ctx.closePath();
                                ctx.fillStyle = `rgba(${v0.col[0] >> 0 & 0xff}, ${v0.col[0] >> 8 & 0xff}, ${v0.col[0] >> 16 & 0xff}, ${(v0.col[0] >> 24 & 0xff) / 0xff})`;
                                ctx.fill();
                            }
                        }
                        ctx.restore();
                    }
                }
            }
        });
    });

}

export function CreateFontsTexture(): void {
    const io = ImGui.GetIO();

    // Backup GL state
    const last_texture: WebGLTexture | null = gl && gl.getParameter(gl.TEXTURE_BINDING_2D);

    // Build texture atlas
    // const width: number = 256;
    // const height: number = 256;
    // const pixels: Uint8Array = new Uint8Array(4 * width * height).fill(0xff);
    const { width, height, pixels } = io.Fonts.GetTexDataAsRGBA32();   // Load as RGBA 32-bits (75% of the memory is wasted, but default font is so small) because it is more likely to be compatible with user's existing shaders. If your ImTextureId represent a higher-level concept than just a GL texture id, consider calling GetTexDataAsAlpha8() instead to save on GPU memory.
    // console.log(`font texture ${width} x ${height} @ ${pixels.length}`);

    // Upload texture to graphics system
    g_FontTexture = gl && gl.createTexture();
    gl && gl.bindTexture(gl.TEXTURE_2D, g_FontTexture);
    gl && gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl && gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // gl && gl.pixelStorei(gl.UNPACK_ROW_LENGTH); // WebGL2
    gl && gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Store our identifier
    io.Fonts.TexID = g_FontTexture || { foo: "bar" };
    // console.log("font texture id", g_FontTexture);

    if (ctx) {
        const image_canvas: HTMLCanvasElement = document.createElement("canvas");
        image_canvas.width = width;
        image_canvas.height = height;
        const image_ctx = image_canvas.getContext("2d");
        if (image_ctx === null) { throw new Error(); }
        const image_data = image_ctx.getImageData(0, 0, width, height);
        image_data.data.set(pixels);
        image_ctx.putImageData(image_data, 0, 0);
        io.Fonts.TexID = image_canvas;
    }

    // Restore modified GL state
    gl && last_texture && gl.bindTexture(gl.TEXTURE_2D, last_texture);
}

export function DestroyFontsTexture(): void {
    const io = ImGui.GetIO();
    io.Fonts.TexID = null;
    gl && gl.deleteTexture(g_FontTexture); g_FontTexture = null;
}

export function CreateDeviceObjects(): void {
    const vertex_shader: string[] = [
        "uniform mat4 ProjMtx;",
        "attribute vec2 Position;",
        "attribute vec2 UV;",
        "attribute vec4 Color;",
        "varying vec2 Frag_UV;",
        "varying vec4 Frag_Color;",
        "void main() {",
        "	Frag_UV = UV;",
        "	Frag_Color = Color;",
        "	gl_Position = ProjMtx * vec4(Position.xy,0,1);",
        "}",
    ];

    const fragment_shader: string[] = [
        "precision mediump float;", // WebGL requires precision specifiers
        "uniform sampler2D Texture;",
        "varying vec2 Frag_UV;",
        "varying vec4 Frag_Color;",
        "void main() {",
        "	gl_FragColor = Frag_Color * texture2D(Texture, Frag_UV);",
        "}",
    ];

    g_ShaderHandle = gl && gl.createProgram();
    g_VertHandle = gl && gl.createShader(gl.VERTEX_SHADER);
    g_FragHandle = gl && gl.createShader(gl.FRAGMENT_SHADER);
    gl && gl.shaderSource(g_VertHandle as WebGLShader, vertex_shader.join("\n"));
    gl && gl.shaderSource(g_FragHandle as WebGLShader, fragment_shader.join("\n"));
    gl && gl.compileShader(g_VertHandle as WebGLShader);
    gl && gl.compileShader(g_FragHandle as WebGLShader);
    gl && gl.attachShader(g_ShaderHandle as WebGLProgram, g_VertHandle as WebGLShader);
    gl && gl.attachShader(g_ShaderHandle as WebGLProgram, g_FragHandle as WebGLShader);
    gl && gl.linkProgram(g_ShaderHandle as WebGLProgram);

    g_AttribLocationTex = gl && gl.getUniformLocation(g_ShaderHandle as WebGLProgram, "Texture");
    g_AttribLocationProjMtx = gl && gl.getUniformLocation(g_ShaderHandle as WebGLProgram, "ProjMtx");
    g_AttribLocationPosition = gl && gl.getAttribLocation(g_ShaderHandle as WebGLProgram, "Position") || 0;
    g_AttribLocationUV = gl && gl.getAttribLocation(g_ShaderHandle as WebGLProgram, "UV") || 0;
    g_AttribLocationColor = gl && gl.getAttribLocation(g_ShaderHandle as WebGLProgram, "Color") || 0;

    g_VboHandle = gl && gl.createBuffer();
    g_ElementsHandle = gl && gl.createBuffer();

    CreateFontsTexture();
}

export function DestroyDeviceObjects(): void {
    DestroyFontsTexture();

    const gl2: WebGL2RenderingContext | null = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext && gl || null;

    // Destroy the temporary VAO
    gl2 && gl2.deleteVertexArray(vertex_array_object) || gl_vao && gl_vao.deleteVertexArrayOES(vertex_array_object);

    gl && gl.deleteBuffer(g_VboHandle); g_VboHandle = null;
    gl && gl.deleteBuffer(g_ElementsHandle); g_ElementsHandle = null;

    g_AttribLocationTex = null;
    g_AttribLocationProjMtx = null;
    g_AttribLocationPosition = -1;
    g_AttribLocationUV = -1;
    g_AttribLocationColor = -1;

    gl && gl.deleteProgram(g_ShaderHandle); g_ShaderHandle = null;
    gl && gl.deleteShader(g_VertHandle); g_VertHandle = null;
    gl && gl.deleteShader(g_FragHandle); g_FragHandle = null;
}
