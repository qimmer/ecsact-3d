import {EntityManager, IEntityQuery} from "ecsact";
import {Service} from "typedi";
import {ILifetime, LifetimeTags} from "@components/Lifetime";
import {ITickable} from "@src/ITickable";

@Service()
export class LifetimeSystem implements ITickable {
    private entityManager: EntityManager;
    private lifetimeQuery: IEntityQuery<ILifetime>;

    constructor(entityManager: EntityManager) {
        this.entityManager = entityManager;
        this.lifetimeQuery = entityManager.query([LifetimeTags.LIFETIME]);
    }

    tick(dt:number) {
        this.lifetimeQuery.forEach(lifetime => {
            lifetime.remainingSeconds -= dt;

            if(lifetime.remainingSeconds <= 0) {
                if(lifetime.onExpired) {
                    lifetime.onExpired();
                } else {
                    lifetime.destroy();
                }
            }
        });
    }
}
