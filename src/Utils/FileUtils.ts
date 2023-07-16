
export function loadUserFile(fileExtensions:string[]):Promise<{fileName:string, data:Uint8Array}> {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = fileExtensions.join(',');

        input.onchange = (e:any) => {
            const file = e.target.files[0],
                reader = new FileReader();

            reader.readAsArrayBuffer(file);
            reader.onload = readerEvent => {
                if(readerEvent.target) {
                    const content = <ArrayBuffer>readerEvent.target.result;
                    resolve({fileName: input.value, data: new Uint8Array(content)});
                }
            }

            reader.onerror = event => {
                reject(event);
            };
        }

        input.onabort = () => {
            reject();
        };

        input.onclose = () => {

        };

        input.click();
    });
}
