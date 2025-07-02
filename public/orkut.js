const axios = require('axios');
const FormData = require('form-data');
const QRCode = require('qrcode');
const { Readable } = require('stream');
const { fromBuffer } = require('file-type');

// Helper functions remain the same
function convertCRC16(str) {
    let crc = 0xFFFF;
    const strlen = str.length;
    for (let c = 0; c < strlen; c++) {
        crc ^= str.charCodeAt(c) << 8;
        for (let i = 0; i < 8; i++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }
    let hex = crc & 0xFFFF;
    hex = ("000" + hex.toString(16).toUpperCase()).slice(-4);
    return hex;
}

function generateTransactionId() {
    const randomString = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `FAHRI-${randomString}`;
}

function generateExpirationTime() {
    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() + 30);
    return expirationTime;
}

const api = async (fileBuffer) => {
    try {
        const formData = new FormData();
        formData.append('image', fileBuffer, {
            filename: 'upload.png',
            contentType: 'image/png'
        });

        const response = await axios.post('https://tourl.fahri-hosting.xyz/upload.php', formData, {
            headers: formData.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            validateStatus: () => true // Biarkan kita cek response bahkan kalau status bukan 200
        });

        const text = response.data;

        if (typeof text === 'string' && text.startsWith('http')) {
            return text.trim();
        } else {
            throw new Error(`Upload error: Unexpected response from upload.php: ${text}`);
        }
    } catch (error) {
        throw new Error(`Upload error: ${error.message}`);
    }
};

async function uploadToSupaCodes(fileBuffer) {
    try {
        const imageUrl = await api(fileBuffer);
        console.log('Uploaded to:', imageUrl);
        return imageUrl;
    } catch (error) {
        console.error('Upload to tourl failed:', error.message);
        throw error;
    }
}

async function generateQRIS(amount) {
    try {
        let qrisData = "your_qris_code_here"; // Replace with actual QRIS code
        qrisData = qrisData.slice(0, -4);
        const step1 = qrisData.replace("010211", "010212");
        const step2 = step1.split("5802ID");
        
        amount = parseInt(amount).toString();
        let uang = "54" + ("0" + amount.length).slice(-2) + amount;
        uang += "5802ID";
        
        const result = step2[0] + uang + step2[1] + convertCRC16(step2[0] + uang + step2[1]);
        
        const buffer = await QRCode.toBuffer(result, {
            errorCorrectionLevel: 'H',
            type: 'png',
            margin: 1,
            width: 300
        });

        const imageUrl = await uploadToSupaCodes(buffer);
        return {
            transactionId: generateTransactionId(),
            amount: amount,
            expirationTime: generateExpirationTime(),
            qrImageUrl: imageUrl,
            qrString: result
        };
    } catch (error) {
        console.error('Error in generateQRIS:', error);
        throw error;
    }
}

async function createQRIS(amount, codeqr) {
    if (!codeqr) throw new Error("QRIS code is required");

    let qrisData = codeqr.slice(0, -4);
    const step1 = qrisData.replace("010211", "010212");
    const step2 = step1.split("5802ID");

    amount = parseInt(amount).toString();
    let uang = "54" + ("0" + amount.length).slice(-2) + amount;
    uang += "5802ID";

    const result = step2[0] + uang + step2[1] + convertCRC16(step2[0] + uang + step2[1]);

    // Langsung buat URL QR dari API publik
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result)}`;

    return {
        transactionId: generateTransactionId(),
        amount: amount,
        expirationTime: generateExpirationTime(),
        qrImageUrl: qrImageUrl,
        qrString: result
    };
}

async function checkQRISStatus(merchantId, apiKey) {
    try {
        if (!merchantId || !apiKey) {
            throw new Error('Merchant ID and API Key are required');
        }

        const apiUrl = `https://gateway.okeconnect.com/api/mutasi/qris/${merchantId}/${apiKey}`;
        const response = await axios.get(apiUrl);
        const result = response.data;
        const data = result.data;
        
        let capt = '*Q R I S - M U T A S I*\n\n';
        if (!data || data.length === 0) {
            capt += 'Tidak ada data mutasi.';
        } else {
            data.forEach(entry => {
                capt += '```Tanggal:```' + ` ${entry.date}\n`;
                capt += '```Issuer:```' + ` ${entry.brand_name}\n`;
                capt += '```Nominal:```' + ` Rp ${entry.amount}\n\n`;
            });
        }
        return capt;
    } catch (error) {
        console.error('Error checking QRIS status:', error);
        throw error;
    }
}

module.exports = {
    convertCRC16,
    generateTransactionId,
    generateExpirationTime,
    uploadToSupaCodes,
    generateQRIS,
    createQRIS,
    checkQRISStatus
};
