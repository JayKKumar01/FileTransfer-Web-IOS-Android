// File: zip-util.js
import { PREFIX, ZIP_TOGGLE } from './constants.js';
import { appendLog } from './utils.js';
import { downloadBlob } from './receiver-util.js';

let isZipSelected = true;

// Handle the state change when the checkbox is toggled
ZIP_TOGGLE.addEventListener('change', function () {
    isZipSelected = this.checked;
    appendLog(`Zip download is ${isZipSelected ? 'enabled' : 'disabled'}`);
});

export function getIsZipSelected() {
    return isZipSelected;
}

let jsZip;

export function resetZip() {
    jsZip = new JSZip();
}

export async function addToZip(fileName, blob, isLastFile) {
    try {
        jsZip.file(fileName, blob);
        appendLog(`${fileName} successfully added to the zip.`);
        if (isLastFile) {
            zipAndDownload();
        }
    } catch (error) {
        appendLog(`Error while zipping ${fileName}: ${error.message}`);
        console.error(`Error adding ${fileName} to zip:`, error);
    }
}

async function zipAndDownload() {
    try {
        appendLog("Generating ZIP file for download...");

        const zipBlob = await jsZip.generateAsync({ type: 'blob' });
        appendLog("ZIP file generated successfully.");

        // Reusing downloadBlob to handle Safari & other browsers correctly
        downloadBlob(`${PREFIX}${Date.now()}.zip`, zipBlob);

        appendLog("Downloaded all files as ZIP!");
    } catch (error) {
        appendLog(`Error during ZIP generation: ${error.message}`);
        console.error("Error generating ZIP:", error);
    }
}



// async function zipAndDownload() {
//     try {
//         appendLog("Generating zip file to download...");
//         const zipBlob = await jsZip.generateAsync({ type: 'blob' });
//         appendLog("ZIP file generated successfully.");

//         const link = document.createElement('a');
//         link.href = URL.createObjectURL(zipBlob);
//         link.download = `${PREFIX}${Date.now()}.zip`;

//         link.click();

//         URL.revokeObjectURL(link.href);
//         appendLog("Downloaded all files as ZIP!");
//     } catch (error) {
//         appendLog(`Error during zip generation: ${error.message}`);
//         console.error("Error generating zip:", error);
//     }
// }
