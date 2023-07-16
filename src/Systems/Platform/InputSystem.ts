import {ITickable} from "@src/ITickable";
import {EntityManager} from "ecsact";
import {
    IPlatform,
    MouseButtonToKeyName,
    MouseMovementKeyNames,
    PlatformTags,
    ScrollKeyNames
} from "@components/Platform";
import {IEntityQuery} from "ecsact";
import {ICanvasRenderTarget, RenderTags} from "@components/Render";
import {IXY} from "@src/Utils/Math";
import {Service} from "typedi";

@Service()
export class InputSystem implements ITickable {
    private readonly platformQuery: IEntityQuery<IPlatform>;
    private entityManager: EntityManager;
    private canvasRenderTargetQuery: IEntityQuery<ICanvasRenderTarget>;
    private subscribedCanvases: Set<HTMLCanvasElement>;
    private lastMouseCursor: IXY|null;

    constructor(entityManager:EntityManager) {
        this.platformQuery = entityManager.query([PlatformTags.PLATFORM]);
        this.canvasRenderTargetQuery = entityManager.query([RenderTags.CANVAS_RENDERTARGET]);
        this.entityManager = entityManager;
        this.subscribedCanvases = new Set<HTMLCanvasElement>();
        this.lastMouseCursor = null;

        if (typeof(window) !== "undefined") {
            window.addEventListener("gamepadconnected", event => this.window_on_gamepadconnected(event));
            window.addEventListener("gamepaddisconnected", event => this.window_on_gamepaddisconnected(event));
        }

        window.addEventListener("blur", event => this.canvas_on_blur(event));
        window.addEventListener("keydown", event => this.canvas_on_keydown(event));
        window.addEventListener("keyup", event => this.canvas_on_keyup(event));
        window.addEventListener("keypress", event => this.canvas_on_keypress(event));
        window.addEventListener("pointermove", event => this.canvas_on_pointermove(event));
        window.addEventListener("pointerdown", event => this.canvas_on_pointerdown(event));
        window.addEventListener("contextmenu", event => this.canvas_on_contextmenu(event));
        window.addEventListener("pointerup", event => this.canvas_on_pointerup(event));
        window.addEventListener("wheel", event => this.canvas_on_wheel(event));
    }

    tick(deltaTime: number): void {
        this.platformQuery.forEach(platform => {
            let canvas = platform.context.canvas,
                inputState = platform.context.inputState,
                mouseDelta;

            if(canvas && !this.subscribedCanvases.has(canvas)) {

                this.subscribedCanvases.add(canvas);
            }

            if(!this.lastMouseCursor) {
                mouseDelta = {x: 0, y: 0};
            } else {
                mouseDelta = {x: inputState.cursor.x - this.lastMouseCursor.x, y: inputState.cursor.y - this.lastMouseCursor.y};
            }

            mouseDelta = inputState.cursorDelta;
            inputState.cursorDelta = {
                x: 0,
                y: 0
            };

            this.lastMouseCursor = inputState.cursor;

            inputState.keyState[MouseMovementKeyNames.MouseXPositive] = Math.max(0, mouseDelta.x);
            inputState.keyState[MouseMovementKeyNames.MouseXNegative] = Math.max(0, -mouseDelta.x);
            inputState.keyState[MouseMovementKeyNames.MouseYPositive] = Math.max(0, -mouseDelta.y);
            inputState.keyState[MouseMovementKeyNames.MouseYNegative] = Math.max(0, mouseDelta.y);

        });
    }

    window_on_gamepadconnected(event: any /* GamepadEvent */): void {
        console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
            event.gamepad.index, event.gamepad.id,
            event.gamepad.buttons.length, event.gamepad.axes.length);

        this.platformQuery.forEach(platform => {
            platform.context.inputState.gamePads.push(event.gamepad);
        });
    }

    window_on_gamepaddisconnected(event: any /* GamepadEvent */): void {
        console.log("Gamepad disconnected at index %d: %s.",
            event.gamepad.index, event.gamepad.id);

        this.platformQuery.forEach(platform => {
            platform.context.inputState.gamePads.splice(platform.context.inputState.gamePads.indexOf(event.gamepad), 1);
        });
    }

    canvas_on_blur(event: FocusEvent): void {
        this.platformQuery.forEach(platform => {
            let inputState = platform.context.inputState;

            for(let key in inputState.keyState) {
                inputState.keyState[key] = 0.0;
            }
        });
    }

    canvas_on_keydown(event: KeyboardEvent): boolean {
        this.platformQuery.forEach(platform => {
            let inputState = platform.context.inputState;

            inputState.keyState[event.key] = 1.0;

            if(inputState.grab) {
                event.preventDefault();
            }
        });

        return false;
    }

    canvas_on_keyup(event: KeyboardEvent): boolean  {
        this.platformQuery.forEach(platform => {
            let inputState = platform.context.inputState;

            inputState.keyState[event.key] = 0.0;

            if(inputState.grab) {
                event.preventDefault();
            }
        });

        return false;
    }

    canvas_on_keypress(event: KeyboardEvent): boolean  {
        this.platformQuery.forEach(platform => {
            let inputState = platform.context.inputState;

            inputState.inputCharacters += String.fromCharCode(event.charCode);

            if(inputState.grab) {
                event.preventDefault();
            }
        });

        return false;
    }

    canvas_on_pointermove(event: PointerEvent): void  {
        this.platformQuery.forEach(platform => {
            let inputState = platform.context.inputState;

            inputState.cursor = {
                x: event.offsetX,
                y: event.offsetY
            }

            inputState.cursorDelta = {
                x: event.movementX,
                y: event.movementY
            }

            if(inputState.grab) {
                event.preventDefault();
            }
        });
    }

    canvas_on_pointerdown(event: PointerEvent): void  {
        this.platformQuery.forEach(platform => {
            let inputState = platform.context.inputState;

            inputState.keyState[MouseButtonToKeyName[event.button]] = 1.0;

            inputState.cursor = {
                x: event.offsetX,
                y: event.offsetY
            }

            if(inputState.grab || event.button > 2) {
                event.preventDefault();
            }
        });
    }
    canvas_on_contextmenu(event: Event): void  {
        event.preventDefault();
    }

    canvas_on_pointerup(event: PointerEvent): void  {
        this.platformQuery.forEach(platform => {
            let inputState = platform.context.inputState;

            inputState.keyState[MouseButtonToKeyName[event.button]] = 0.0;

            inputState.cursor = {
                x: event.offsetX,
                y: event.offsetY
            }

            if(inputState.grab || event.button > 2) {
                event.preventDefault();
            }
        });
    }

    canvas_on_wheel(event: WheelEvent): void  {
        this.platformQuery.forEach(platform => {
            let inputState = platform.context.inputState;

            let scale: number = 1.0;
            switch (event.deltaMode) {
                case event.DOM_DELTA_PIXEL: scale = 0.01; break;
                case event.DOM_DELTA_LINE: scale = 0.2; break;
                case event.DOM_DELTA_PAGE: scale = 1.0; break;
            }

            inputState.keyState[ScrollKeyNames.V_SCROLL] = -event.deltaY * scale;
            inputState.keyState[ScrollKeyNames.H_SCROLL] = event.deltaX * scale;

            if(inputState.grab) {
                event.preventDefault();
            }
        });
    }
}


@Service()
export class InputResetSystem implements ITickable {
    private readonly platformQuery: IEntityQuery<IPlatform>;

    constructor(entityManager:EntityManager) {
        this.platformQuery = entityManager.query([PlatformTags.PLATFORM]);
    }

    tick(deltaTime: number): void {
        this.platformQuery.forEach(platform => {
            let inputState = platform.context.inputState;

            inputState.keyState[MouseMovementKeyNames.MouseXPositive] = 0;
            inputState.keyState[MouseMovementKeyNames.MouseXNegative] = 0;
            inputState.keyState[MouseMovementKeyNames.MouseYPositive] = 0;
            inputState.keyState[MouseMovementKeyNames.MouseYNegative] = 0;
        });
    }
}
