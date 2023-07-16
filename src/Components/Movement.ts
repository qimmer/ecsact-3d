import {IEulerTransform, ITransform, TransformTags} from "./Transform";
import {IXYZ} from "@src/Utils/Math";
import {EntityManager} from "ecsact";

export interface IMoving extends ITransform {
    velocity: IXYZ
}

export interface IRelativeMoving extends IMoving, IEulerTransform {
    movement: IXYZ
}

export interface IRotating extends IEulerTransform {
    torque: IXYZ
}

export const MovementTags = {
    MOVING: 'moving',
    RELATIVE_MOVING: 'relative_moving',
    ROTATING: 'rotating'
}

export function MovementComponent(entityManager:EntityManager) {
    entityManager.query<IMoving>([MovementTags.MOVING]).subscribeAdded(entity => {
        entity.add(TransformTags.TRANSFORM).set({
            velocity: {x: 0, y: 0, z: 0}
        }, false);
    });

    entityManager.query<IMoving>([MovementTags.MOVING]).subscribeRemoved(entity => {
        entity.unset({velocity: null});
    });

    entityManager.query<IRotating>([MovementTags.ROTATING]).subscribeAdded(entity => {
        entity.add(TransformTags.EULER_TRANSFORM).set({
            torque: {x: 0, y: 0, z: 0}
        }, false);
    });

    entityManager.query<IRotating>([MovementTags.ROTATING]).subscribeRemoved(entity => {
        entity.unset({torque: null});
    });

    entityManager.query<IRelativeMoving>([MovementTags.RELATIVE_MOVING]).subscribeAdded(entity => {
        entity.add(MovementTags.MOVING).set({
            movement: {x: 0, y: 0, z: 0}
        }, false);
    });

    entityManager.query<IRelativeMoving>([MovementTags.RELATIVE_MOVING]).subscribeRemoved(entity => {
        entity.unset({movement: null});
    });

}
