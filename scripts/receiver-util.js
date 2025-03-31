import { getConnection } from './peer-util.js';
import {
    appendLog,
    calculateTransferRate,
    hideProgressContainer,
    updateProgressBar,
    showProgressContainer,
} from './utils.js';
import { getIsZipSelected, resetZip, addToZip } from './zip-util.js';

let isMultipleFiles;
let time;
let transferTime;
let conn;

const receivedFileData = new Map();

export function ready(data) {
    conn = getConnection();
    showProgressContainer("Download", data.fileName, data.indexInfo);
    time = new Date();
    transferTime = time;
    isMultipleFiles = data.fileCount > 1;
    if (data.isFirstFile) {
        resetZip();
    }
}

export async function handleFileData(data) {
    const fileName = data.name;
    const fileData = data.data;
    const fileTransferId = data.id;
    const isLastFile = data.isLastFile;
    const totalSize = data.totalSize;

    if (!receivedFileData.has(fileTransferId)) {
        const stream = new WritableStream({
            write(chunk) {
                return fileTransferInfo.writer.write(chunk);
            },
            close() {
                finalizeFileHandling(fileName, fileTransferId, isLastFile);
            },
        });

        const writer = stream.getWriter();
        receivedFileData.set(fileTransferId, { writer, totalSize, receivedSize: 0 });
    }

    const fileTransferInfo = receivedFileData.get(fileTransferId);
    await fileTransferInfo.writer.write(fileData);
    fileTransferInfo.receivedSize += fileData.byteLength;

    const progress = Math.floor((fileTransferInfo.receivedSize / totalSize) * 100);
    const timeElapsed = (new Date() - transferTime) / 1000;
    const transferRate = timeElapsed > 0 ? Math.floor((fileData.byteLength / 1024) / timeElapsed) : 0;
    transferTime = new Date();

    updateProgressBar("Download", progress, transferRate);
    updateSender(fileTransferId, progress, transferRate);

    if (fileTransferInfo.receivedSize === totalSize) {
        await fileTransferInfo.writer.close();
        receivedFileData.delete(fileTransferId);
    }
}

function updateSender(id, progress, transferRate) {
    conn.send({
        type: 'signal',
        id: id,
        progress: progress,
        transferRate: transferRate,
    });
}

async function finalizeFileHandling(fileName, fileTransferId, isLastFile) {
    try {
        const fileTransferInfo = receivedFileData.get(fileTransferId);
        if (!fileTransferInfo) return;
        
        let blob = new Blob([fileTransferInfo.writer]);
        
        if (getIsZipSelected() && isMultipleFiles) {
            await addToZip(fileName, blob, isLastFile);
        } else {
            downloadBlob(fileName, blob);
        }

        blob = null;
        receivedFileData.delete(fileTransferId);

        if (isLastFile) {
            appendLog("Done! All files have been processed.");
            hideProgressContainer();
        }
    } catch (error) {
        appendLog(`Error processing file ${fileName}: ${error.message}`);
        console.error(`Error finalizing ${fileName}:`, error);
    }
}

export function downloadBlob(fileName, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 100);
}
