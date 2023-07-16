import * as ImGui from "@src/ImGui/imgui";
import * as ImGui_Impl from "@src/ImGui/imgui_impl";

import {ITickable} from "@src/ITickable";
import {EntityManager} from "ecsact";
import {IPlatform, PlatformTags} from "@components/Platform";
import {IImGuiContext, ImGuiTags} from "@components/ImGui";
import {IEntityQuery} from "ecsact";
import {Service} from "typedi";

@Service()
export class ImGuiPreFrameSystem implements ITickable {
    private platformQuery: IEntityQuery<IPlatform>;
    private entityManager: EntityManager;
    private imguiQuery: IEntityQuery<IImGuiContext>;
    private imguiInitializedQuery: IEntityQuery<IImGuiContext>;

    constructor(entityManager:EntityManager) {
        this.entityManager = entityManager;
        this.platformQuery = entityManager.query([PlatformTags.PLATFORM]);
        this.imguiQuery = entityManager.query([ImGuiTags.IMGUI_CONTEXT]);
        this.imguiInitializedQuery = entityManager.query([ImGuiTags.IMGUI_CONTEXT, ImGuiTags.IMGUI_INITIALIZED]);

        entityManager.query<IImGuiContext>([ImGuiTags.IMGUI_CONTEXT]).subscribeAdded(imgui => {
            let platform = this.platformQuery.singleton();

            ImGui.default().then(() => {
                ImGui.CHECKVERSION();
                imgui.context = ImGui.CreateContext();
                const io:ImGui.IO=ImGui.GetIO();
                ImGui.StyleColorsDark();
                io.Fonts.AddFontDefault();

                ImGui_Impl.Init(platform.context.gl);

                imgui.add(ImGuiTags.IMGUI_INITIALIZED);
            });
        });
    }

    tick(deltaTime: number): void {
        this.imguiInitializedQuery.forEach(imgui => {
            ImGui.SetCurrentContext(imgui.context);
            ImGui_Impl.NewFrame(deltaTime);
            ImGui.NewFrame();
        });
    }
}

@Service()
export class ImGuiPostFrameSystem implements ITickable {
    private imguiInitializedQuery: IEntityQuery<IImGuiContext>;

    constructor(entityManager:EntityManager) {
        this.imguiInitializedQuery = entityManager.query([ImGuiTags.IMGUI_CONTEXT, ImGuiTags.IMGUI_INITIALIZED]);
    }

    tick(deltaTime: number): void {
        this.imguiInitializedQuery.forEach(imgui => {
            ImGui.SetCurrentContext(imgui.context);
            ImGui.EndFrame();
            ImGui.Render();

            ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
        });
    }
}

