import {ITickable} from "@src/ITickable";
import {EntityManager} from "ecsact";
import {ActionTags as ActionTags, IActionContext, IActionSettings} from "@components/Action";
import {IEntityQuery} from "ecsact";
import {IPlatform, PlatformTags as PlatformTags} from "@components/Platform";
import * as ImGui from "@src/ImGui/imgui";
import {Service} from "typedi";

/**
 * System that translates platform key/mouse/gamepad input states into key-bound action states
 */
@Service()
export class InputActionTranslationSystem implements ITickable {
    private actionSettingsQuery:IEntityQuery<IActionSettings>;
    private platformQuery: IEntityQuery<IPlatform>;
    private actionStateQuery: IEntityQuery<IActionContext>;

    constructor(entityManager:EntityManager) {
        this.actionSettingsQuery = entityManager.query([ActionTags.ACTION_SETTINGS]);
        this.platformQuery = entityManager.query([PlatformTags.PLATFORM]);
        this.actionStateQuery = entityManager.query([ActionTags.ACTION_CONTEXT]);
    }

    tick(deltaTime: number) {
        let isInEditor = ImGui && ImGui.GetCurrentContext() && (ImGui.GetIO().WantCaptureMouse || ImGui.GetIO().WantCaptureKeyboard),
            platform = this.platformQuery.trySingleton(),
            actionSettings = this.actionSettingsQuery.trySingleton(),
            actionState = this.actionStateQuery.trySingleton();

        if(platform && actionSettings && actionState) {
            for (let action in actionSettings.actionBindings) {
                let key = actionSettings.actionBindings[action];

                if(!key || isInEditor) {
                    actionState.actionStates[action] = 0.0;
                } else {
                    actionState.actionStates[action] = platform.context.inputState.keyState[key] || 0.0;
                }
            }
        }
    }
}
