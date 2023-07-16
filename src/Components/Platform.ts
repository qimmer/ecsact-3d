import {IEntity} from "ecsact";
import {ICanvasRenderTarget, RenderTags} from "./Render";
import {EntityManager} from "ecsact";
import {IXY} from "@src/Utils/Math";

export const MouseButtonToKeyName:string[] = [
    'LeftMouseButton',
    'MiddleMouseButton',
    'RightMouseButton',
    'ThumbMouseButton1',
    'ThumbMouseButton2'
];

export enum ScrollKeyNames {
    V_SCROLL= 'Vertical_Scroll',
    H_SCROLL= 'Horizontal_Scroll'
}

export enum MouseMovementKeyNames {
    MouseXPositive= 'MouseX+',
    MouseXNegative= 'MouseX-',
    MouseYPositive= 'MouseY+',
    MouseYNegative= 'MouseY-',
}

export interface IGamePad {

}

export interface IRenderingContext extends ICanvasRenderTarget, IEntity {
    gl: WebGLRenderingContext;
}

export interface IInputContext extends IEntity {
    inputState: {
        gamePads: {
            id: string;
            buttons: number;
        }[];
        cursor: IXY;
        cursorDelta: IXY;
        inputCharacters: string;
        keyState: Record<string, number>;
        grab: boolean;
    };
}

export interface IPlatform extends IEntity {
    context: IRenderingContext & IInputContext;
}

export const PlatformTags = {
    PLATFORM: 'platform',
    RENDERING_CONTEXT: 'rendering_context',
    INPUT_CONTEXT: 'input_context'
}


export function PlatformComponent(entityManager:EntityManager) {
    entityManager.query<IPlatform>([PlatformTags.PLATFORM]).subscribeAdded(entity => {
        entity.set({
            context: {
                tags: [PlatformTags.RENDERING_CONTEXT, PlatformTags.INPUT_CONTEXT]
            }
        }, false);
    });

    entityManager.query<IPlatform>([PlatformTags.PLATFORM]).subscribeRemoved(entity => {
        entity.unset({context: null});
    });

    entityManager.query<IRenderingContext>([PlatformTags.RENDERING_CONTEXT]).subscribeAdded(entity => {
        entity.add(RenderTags.CANVAS_RENDERTARGET);
    });
    entityManager.query<IRenderingContext>([PlatformTags.RENDERING_CONTEXT]).subscribeRemoved(entity => {
    });

    entityManager.query<IInputContext>([PlatformTags.INPUT_CONTEXT]).subscribeAdded(entity => {
        entity.set(<IInputContext>{
            inputState: {
                cursor: {
                    x: 0,
                    y: 0
                },
                cursorDelta: {
                    x: 0,
                    y: 0
                },
                inputCharacters: "",
                keyState: {}
            }
        });

    });

    entityManager.query<IInputContext>([PlatformTags.INPUT_CONTEXT]).subscribeRemoved(entity => {
        entity.unset({inputState: null});
    });
}
