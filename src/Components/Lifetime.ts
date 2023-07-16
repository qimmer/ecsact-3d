import {EntityManager} from "ecsact";
import {IEntity} from "ecsact";

export const LifetimeTags = {
    LIFETIME: 'lifetime'
};

export interface ILifetime extends IEntity {
    remainingSeconds: number;
    onExpired?: ()=>void;
}

export function LifetimeComponent(entityManager:EntityManager) {
    entityManager.query<ILifetime>([LifetimeTags.LIFETIME]).subscribeAdded(entity => {
        entity.set<ILifetime>({
            remainingSeconds: Number.MAX_SAFE_INTEGER
        }, false);
    });
}
