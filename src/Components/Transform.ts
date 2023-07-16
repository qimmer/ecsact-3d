import {IEntity} from "ecsact";
import {mat4} from "gl-matrix";
import {IXYZ, IXYZW} from "@src/Utils/Math";
import {EntityManager} from "ecsact";

export interface IWorldTransform extends IEntity {
    world: mat4;
}

export interface ILocalTransform extends IWorldTransform {
    local: mat4;
    parent: IWorldTransform|null;
}

export interface ITransform extends ILocalTransform {
    position: IXYZ,
    scale: IXYZ,
    rotationQuat: IXYZW;
}

export interface IEulerTransform extends ITransform {
    rotationEuler: IXYZ,
}

export interface ITransformSkeleton extends ITransform {
    bones: Record<string, ITransform>;
}

export const TransformTags = {
    WORLD_TRANSFORM: 'world_transform',
    LOCAL_TRANSFORM: 'local_transform',
    TRANSFORM: 'transform',
    EULER_TRANSFORM: 'euler_transform',
    TRANSFORM_SKELETON: 'transform_skeleton',
    TRANSFORM_LEVEL_: 'transform_level_'
}


export function TransformComponent(entityManager:EntityManager) {
    entityManager.query<IWorldTransform>([TransformTags.WORLD_TRANSFORM]).subscribeAdded(entity => {
        entity.set<IWorldTransform>({
            world: mat4.identity(mat4.create())
        }, false);
    });
    entityManager.query<ILocalTransform>([TransformTags.LOCAL_TRANSFORM]).subscribeAdded(entity => {
        let level = -1,
            parent = entity;

        while(parent && parent.has(TransformTags.LOCAL_TRANSFORM)) {
            level++;

            parent = <ILocalTransform>(parent.parent || parent.getOwner());
        }

        entity.add(TransformTags.WORLD_TRANSFORM).add(TransformTags.TRANSFORM_LEVEL_ + level).set<ILocalTransform>({
            local: mat4.identity(mat4.create()),
            parent: null
        }, false);
    });

    entityManager.query<ITransform>([TransformTags.TRANSFORM]).subscribeAdded(entity => {
        entity.add(TransformTags.LOCAL_TRANSFORM).set<ITransform>({
            position: {x: 0, y: 0, z: 0},
            scale: {x: 1, y: 1, z: 1},
            rotationQuat: {x: 0, y: 0, z: 0, w: 1},
        }, false);
    });

    entityManager.query<IEulerTransform>([TransformTags.EULER_TRANSFORM]).subscribeAdded(entity => {
        entity.add(TransformTags.TRANSFORM).set<IEulerTransform>({
            rotationEuler: {x: 0, y: 0, z: 0}
        }, false);
    });

    entityManager.query<IEulerTransform>([TransformTags.TRANSFORM_SKELETON]).subscribeAdded(entity => {
        entity.add(TransformTags.TRANSFORM).set<ITransformSkeleton>({
            bones: {}
        }, false);
    });
}
