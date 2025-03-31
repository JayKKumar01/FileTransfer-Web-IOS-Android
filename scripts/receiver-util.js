// File: receiver-util.js
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

export function handleFileData(data) {
    const fileName = data.name;
    const fileData = data.data;
    const fileTransferId = data.id;
    const isLastFile = data.isLastFile;

    if (!receivedFileData.has(fileTransferId)) {
        receivedFileData.set(fileTransferId, { chunks: [], totalSize: 0 });
    }

    const fileTransferInfo = receivedFileData.get(fileTransferId);
    // Store each chunk as a Blob instead of ArrayBuffer
    const chunkBlob = new Blob([fileData]);
    fileTransferInfo.chunks.push(chunkBlob);
    fileTransferInfo.totalSize += fileData.byteLength;

    const totalSize = data.totalSize;
    const receivedSize = fileTransferInfo.totalSize;
    const progress = Math.floor((receivedSize / totalSize) * 100);

    const timeElapsed = (new Date() - transferTime) / 1000;
    const transferRate = timeElapsed > 0 ? Math.floor((fileData.byteLength / 1024) / timeElapsed) : 0;
    transferTime = new Date();

    updateProgressBar("Download", progress, transferRate);
    updateSender(fileTransferId, progress, transferRate);

    if (receivedSize === totalSize) {
        const timeDiff = new Date() - time;
        const finalRate = calculateTransferRate(totalSize, timeDiff);
        appendLog(`File transfer completed in ${timeDiff / 1000} seconds. Transfer rate: ${finalRate} KB/s`);

        // Use setTimeout to yield to the event loop, allowing UI updates
        setTimeout(() => {
            finalizeFileHandling(fileName, fileTransferId, fileTransferInfo, isLastFile);
        }, 0);
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

async function finalizeFileHandling(fileName, fileTransferId, fileTransferInfo, isLastFile) {
    try {
        // Create the final Blob from the array of Blob chunks
        const blob = new Blob(fileTransferInfo.chunks, { type: 'application/octet-stream' });

        if (getIsZipSelected() && isMultipleFiles) {
            await addToZip(fileName, blob, isLastFile);
        } else {
            downloadBlob(fileName, blob);
        }

        // Cleanup
        fileTransferInfo.chunks = [];
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
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}