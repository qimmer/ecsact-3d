import {ITickable} from "@src/ITickable";
import * as ImGui from "@src/ImGui/imgui";
import {IEntityQuery} from "ecsact";
import {EntityManager} from "ecsact";
import {IImGuiContext, ImGuiTags} from "@components/ImGui";
import {Service} from "typedi";
import {DebugTags, IProfilerInfo} from "@components/Debug";

@Service()
export class ProfilerSystem implements ITickable {
    private imguiQuery: IEntityQuery<IImGuiContext>;
    private profilerQuery: IEntityQuery<IProfilerInfo>;

    constructor(entityManager:EntityManager) {
        this.imguiQuery = entityManager.query([ImGuiTags.IMGUI_CONTEXT, ImGuiTags.IMGUI_INITIALIZED]);
        this.profilerQuery = entityManager.query([DebugTags.PROFILER_INFO]);
    }

    tick(deltaTime: number): void {
        this.imguiQuery.forEach(imgui => {
            this.profilerQuery.forEach(profilerInfo => {
                profilerInfo.fps = 1.0 / deltaTime;

                if(ImGui.Begin("Profiler")) {
                    ImGui.Text("FPS: " + profilerInfo.fps.toFixed(2));
                }

                ImGui.End();
            });
        });
    }
}
