export function base64ToArrayBuffer(base64:string) {
    let binary_string = atob(base64),
        len = binary_string.length,
        bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}
