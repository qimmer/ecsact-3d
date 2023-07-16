import {EntityManager, IEntity} from "ecsact";

export const ActionTags = {
  ACTION_SETTINGS: 'action_settings',
  ACTION_CONTEXT: 'action_context'
}

export interface IActionSettings extends IEntity {
  actionBindings: Record<string, string>;
}

export interface IActionContext extends IEntity {
  actionStates: Record<string, number>;
}

export function ActionComponent(entityManager:EntityManager) {
  entityManager.query<IActionContext>([ActionTags.ACTION_CONTEXT]).subscribeAdded(entity => {
    entity.set({
      actionStates: {
      }
    }, false);
  });
}
