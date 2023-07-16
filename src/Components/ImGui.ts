import * as ImGui from "@src/ImGui/imgui";
import {ImGuiContext} from "@src/ImGui/imgui";
import {IEntity} from "ecsact";
import {EntityManager} from "ecsact";
import {IRenderingContext, PlatformTags} from "./Platform";
import * as ImGui_Impl from "@src/ImGui/imgui_impl";

export const ImGuiTags = {
    IMGUI_CONTEXT: 'imgui_context',
    IMGUI_INITIALIZED: 'imgui_initialized'
};

export interface IImGuiContext extends IEntity {
    isImGuiLoaded: boolean,
    context: ImGuiContext | null
}


export function ImGuiComponent(entityManager:EntityManager) {
    entityManager.query<IImGuiContext&IRenderingContext>([ImGuiTags.IMGUI_CONTEXT]).subscribeAdded(imgui => {
        imgui.add(PlatformTags.RENDERING_CONTEXT);

        ImGui.default().then(() => {
            ImGui.CHECKVERSION();
            imgui.context = ImGui.CreateContext();
            const io:ImGui.IO=ImGui.GetIO();
            ImGui.StyleColorsDark();
            io.Fonts.AddFontDefault();

            ImGui_Impl.Init(imgui.gl);

            imgui.add(ImGuiTags.IMGUI_INITIALIZED);
        });
    });
}
