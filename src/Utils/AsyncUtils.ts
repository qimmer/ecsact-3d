export function nextFrame() {
    return new Promise(requestAnimationFrame);
}

export function sleep(millisecs:number) {
    return new Promise(resolve => setTimeout(resolve, millisecs));
}
