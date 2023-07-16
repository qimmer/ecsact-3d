import {EntityManager, IEntity} from "ecsact";

export const DebugTags = {
  PROFILER_INFO: 'profiler_info'
}

export function DebugComponent(entityManager:EntityManager) {
}

export interface IProfilerInfo extends IEntity {
  fps: number;
}
