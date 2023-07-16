import {EntityManager, IEntity, IEntityQuery} from "ecsact";
import {IResource} from "./Resource";
import {ITickable} from "@src/ITickable";
import {mod} from "@src/Utils/Math";

export const AnimationTags = {
    ANIMATED: 'animated',
    ANIMATION: 'animation'
}

export interface ITrack extends IEntity {
    targetPropertyPaths: string[];
    animate:(root:IEntity, track:ITrack, time:number)=>number;
}

export interface IKeyFrameTrack extends ITrack {
    fps: number;
    keyframes: number[];
}

export interface ICompressedKeyFrameTrack extends ITrack {
    compressedKeyframes: {
        time: number,
        value: number
    }[];
}

export interface IEventTrack extends ITrack {
    event: string;
    timestamps: number[];
}

export interface IAnimation extends IResource {
    tracks: Record<string, ITrack>;
    duration:number;
}

export interface IAnimatedState {
    weight: number;
    animation: IAnimation;
    time: number;
    resolvedTargets: Record<string, Object>;
}

export interface IAnimated extends IEntity {
    states: IAnimatedState[];
}

export class AnimationSystem implements ITickable {
    private animatedQuery: IEntityQuery<IAnimated>;

    constructor(entityManager:EntityManager) {
        this.animatedQuery = entityManager.query<IAnimated>([AnimationTags.ANIMATED]);
    }

    tick(deltaTime: number): void {
        this.animatedQuery.forEach(animated => {
            animated.states.forEach(state => {
                state.time = mod(state.time + deltaTime, state.animation.duration);

                if(!state.resolvedTargets) {
                    state.resolvedTargets = state.animation.tracks.mapEntries<ITrack>(track => {
                        let target = <any>animated;

                        track.targetPropertyPaths.slice(0, track.targetPropertyPaths.length - 1).forEach(pathSegment => {
                            target = target[pathSegment];
                        });

                        return target;
                    });
                }

                state.animation.tracks.forEntries<ITrack>((track, trackId) => {
                    let target = <Record<string, any>>state.resolvedTargets[trackId],
                        targetKey = <string>track.targetPropertyPaths[track.targetPropertyPaths.length - 1],
                        value = track.animate(animated, track, state.time);

                    target[targetKey] = value;
                });
            });
        });
    }
}
