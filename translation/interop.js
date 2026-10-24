let dirty = false, activeWorker;
window.addEventListener('beforeunload', e => { if (dirty || activeWorker) { e.preventDefault(); e.returnValue = ''; } });
export function language() { return navigator.language.startsWith('ko') ? 'ko' : 'en'; }
export function setDirty(value) { dirty = value; }
export function confirmReplace(message) { return !dirty || window.confirm(message); }
export async function prepareDownload(name, stream) {
    const blob = new Blob([await stream.arrayBuffer()], { type: name.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/zip' });
    return URL.createObjectURL(blob);
}
export function releaseDownload(url) { if (url) URL.revokeObjectURL(url); }
export async function bakeFont(bytes, points, listener) {
    if (!window.Worker || !window.OffscreenCanvas) throw Error('This browser cannot generate fonts. Use a current Chrome, Edge or Firefox desktop browser.');
    if (activeWorker) throw Error('A font is already being generated.');
    const worker = new Worker(new URL('font-worker.js', import.meta.url), { type: 'module' });
    activeWorker = worker;
    try {
        return await new Promise((resolve, reject) => {
            const timer = setTimeout(() => { worker.terminate(); reject(Error('Font generation exceeded five minutes. Try a smaller character set.')); }, 300000);
            worker.onerror = e => { clearTimeout(timer); reject(Error(e.message || 'Font worker failed.')); };
            worker.onmessage = ({ data }) => {
                if (data.progress) { listener.invokeMethodAsync('FontProgress', data.progress); return; }
                clearTimeout(timer);
                if (data.error) reject(Error(data.error));
                else {
                    // Nested byte arrays are represented as base64 for the .NET JSON marshaller.
                    data.result.pages = data.result.pages.map(page => {
                        let binary = ''; for (let i = 0; i < page.length; i += 32768) binary += String.fromCharCode(...page.subarray(i, i + 32768));
                        return btoa(binary);
                    });
                    resolve(JSON.stringify(data.result));
                }
            };
            worker.postMessage({ bytes, points });
        });
    } finally { worker.terminate(); activeWorker = null; }
}
