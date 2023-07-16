export interface IForEachable<T> {
    forEach(cb:(value:T)=>void):void;
}

export function range(size:number, startAt:number = 0) {
    let arr = <number[]>new Array(size);
    for( let i = 0; i < size; ++i) {
        arr[i] = startAt + i;
    }
    return arr;
}
export function getRowOffset3D(array: ArrayLike<number>, sx: number, sy: number, sz: number, x: number, y: number, z: number) {
    return (z * sz * sy) + (y * sy) + x
}

export function fill3D<T>(array: Array<T>, sx: number, sy: number, sz: number, minX: number, minY: number, minZ: number, width: number, height: number, depth: number, value: T) {
    let x,
        y,
        z,
        offsetZ,
        offsetY,
        offsetX,
        maxZ = minZ + depth,
        maxY = minY + height,
        maxX = minX + width;

    for(z = minZ; z < maxZ; ++z) {
        offsetZ = z * sz;
        for(y = minY; y < maxY; ++y) {
            offsetY = offsetZ + y * sy;
            for(x = minX; x < maxX; ++x) {
                offsetX = offsetY + x;

                array[offsetX] = value;
            }
        }
    }
}

export function every<T>(set:ReadonlySet<T>, f:(value:T)=>boolean){
    let result = true;
    set.forEach(value => {
        if(!f(value)) {
            result = false;
        }
    })

    return result;
}

export function some<T>(set:ReadonlySet<T>, f:(value:T)=>boolean){
    let result = false;
    set.forEach(value => {
        if(f(value)) {
            result = true;
        }
    })

    return result;
}

type RecordElement<RecordType> = RecordType extends Record<string, infer ElementType>
    ? ElementType
    : never;

type ArrayElement<RecordType> = RecordType extends Array<infer ElementType>
    ? ElementType
    : never;

declare global {
    interface Object {
        forEntries<T = RecordElement<this>>(cb:(value:T, key:string) => void):void;
        mapEntries<T = RecordElement<this>, R = any>(cb:(value:T, key:string) => R):Record<string, R>;
        filterEntries<T = RecordElement<this>>(cb:(value:T, key:string) => boolean):Record<string, T>;
    }

    interface Array<T> {
        mapToObject<R = any>(key: (value:T) => string, cb:(value:T) => R):Record<string, R>;
    }
}

if (!Array.prototype.mapToObject) {
    Object.defineProperty(Array.prototype, 'mapToObject', {
        value: function<T, R> (getKey: (value:T)=>string, callback: (value:T) => R) {
            if (this == null) {
                throw new TypeError('Not an array');
            }

            let obj:Record<string, R> = {};
            this.forEach((element:T) => {
                let key = getKey(element);
                obj[key] = callback(element);
            });
            return obj;
        }
    });
}

if (!Object.prototype.forEntries) {
    Object.defineProperty(Object.prototype, 'forEntries', {
        value: function<T> (callback: (value:T, key:string) => void) {
            if (this == null) {
                throw new TypeError('Not an object');
            }

            for (var key in this) {
                if (this.hasOwnProperty(key)) {
                    callback.call(this, this[key], key);
                }
            }
        }
    });
}

if (!Object.prototype.mapEntries) {
    Object.defineProperty(Object.prototype, 'mapEntries', {
        value: function<T, R> (callback: (value:T, key:string) => R) {
            if (this == null) {
                throw new TypeError('Not an object');
            }

            let newObj:Record<string, R> = {};
            for (var key in this) {
                if (this.hasOwnProperty(key)) {
                    newObj[key] = callback.call(this, this[key], key);
                }
            }
            return newObj;
        }
    });
}

if (!Object.prototype.filterEntries) {
    Object.defineProperty(Object.prototype, 'filterEntries', {
        value: function<T> (callback: (value:T, key:string) => boolean) {
            if (this == null) {
                throw new TypeError('Not an object');
            }

            let newObj:Record<string, T> = {};
            for (var key in this) {
                if (this.hasOwnProperty(key)) {
                    if(callback.call(this, this[key], key)) {
                        newObj[key] = this[key];
                    }
                }
            }
            return newObj;
        }
    });
}

