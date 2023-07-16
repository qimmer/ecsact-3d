import {ITickable} from "@src/ITickable";
import {Service} from "typedi";

@Service()
export class DebugDrawSystem implements ITickable {
    constructor() {
    }

    tick(deltaTime: number): void {

    }
}
