import {CameraComponent} from "./Camera";
import {LightComponent} from "./Light";
import {MovementComponent} from "./Movement";
import {PlatformComponent} from "./Platform";
import {RenderComponent} from "./Render";
import {SceneRenderingComponent} from "./SceneRendering";
import {TransformComponent} from "./Transform";
import {PrefabComponent} from "./Prefab";
import {ResourceComponent} from "./Resource";
import {ImGuiComponent} from "./ImGui";
import {ActionComponent} from "./Action";

export * from "./Camera";
export * from "./Action";
export * from "./Light";
export * from "./Movement";
export * from "./Platform";
export * from "./Render";
export * from "./SceneRendering";
export * from "./Transform";
export * from "./Prefab";
export * from "./Transform";
export * from "./Resource";
export * from "./ImGui";
export * from "./WebGL";

export const Components:Function[] = [
  CameraComponent,
  LightComponent,
  MovementComponent,
  PlatformComponent,
  RenderComponent,
  SceneRenderingComponent,
  TransformComponent,
  PrefabComponent,
  ResourceComponent,
  ImGuiComponent,
  ActionComponent,
];
