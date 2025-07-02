const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { networkInterfaces } = require('os');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 5000;
const axios = require("axios")
const { spawn } = require('child_process');
const { default: makeWaSocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { setTimeout: sleep } = require('timers/promises');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const nodemailer = require("nodemailer");

const BASE_URL = 'https://h2h.okeconnect.com';
// Konfigurasi API Key dan Merchant
const ownerConfig = {
    apiKey: "161897517388748151162228OKCT51CED7A50B5175EAA865E66B1A83D53A", // Ganti dengan API Key Owner
    merchantId: "OK1162228" // Ganti dengan Merchant ID Owner
};
function generateRandomPassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$!';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function getPublicIP() {
    try {
        const response = await axios.get('https://api64.ipify.org?format=json');
        return response.data.ip;
    } catch (error) {
        console.error('Failed to fetch public IP:', error);
        return 'Unknown';
    }
}
const {
  convertCRC16,
  generateTransactionId,
  generateExpirationTime,
  elxyzFile,
  generateQRIS,
  createQRIS,
  checkQRISStatus
} = require('./public/orkut.js') 

// Middleware
app.enable("trust proxy");
app.set("json spaces", 2);
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
// Fungsi Database
const databasePath = path.join(__dirname, "public", "database.json");

const readDatabase = () => {
  if (!fs.existsSync(databasePath)) {
    fs.writeFileSync(databasePath, JSON.stringify({ users: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(databasePath));
};

// Middleware untuk memvalidasi API key
const validateApiKey = (req, res, next) => {
  const { apikey } = req.query;

  if (!apikey) {
    return res.status(403).json({ error: 'Missing API key.' });
  }

  const db = readDatabase();
  const user = db.users.find((user) => user.apikey === apikey);

  if (!user) {
    return res.status(403).json({ error: 'Invalid API key.' });
  }

  req.user = user; // Simpan data pengguna untuk digunakan di endpoint
  next();
};

app.get('/api/orkut/createpayment', validateApiKey, async (req, res) => {
    const { amount, codeqr } = req.query;
    if (!amount) return res.json("Isi Parameter Amount.");
    if (!codeqr) return res.json("Isi Parameter CodeQr menggunakan qris code kalian.");

    try {
        const qrData = await createQRIS(amount, codeqr);

        // Notifikasi Telegram (async, non-blocking)
        const telegramBotToken = '7917464738:AAGdIVnbDSmPM5uxb4GNbv4f5f2s1rn8_cY';
        const chatId = '7019487697';
        const message = `
🚨 *Notifikasi Pembayaran Baru* 🚨

💰 *Jumlah Pembayaran*: Rp ${amount}
🔳 *Kode QR*: ${codeqr}

Pembayaran baru telah berhasil dibuat menggunakan kode QR Anda.`;

        // Kirim ke Telegram (tidak blocking response)
        fetch(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                photo: qrData.qrImageUrl,
                caption: message,
                parse_mode: 'Markdown'
            })
        }).catch(err => console.error("Telegram Error:", err));

        // Langsung kirim response ke client
        res.json({
            status: true,
            creator: "Fahri - OfficiaL",
            result: qrData
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/orkut/check-balance', async (req, res) => {
    try {
        const { memberId, pin, password } = req.query;
        
        if (!memberId || !pin || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required parameters'
            });
        }

        const response = await axios.get(`${BASE_URL}/trx/balance`, {
            params: {
                memberID: memberId,
                pin: pin,
                password: password
            }
        });

        return res.json({
            status: 'success',
            data: {
                saldo: response.data.balance || response.data.saldo || 0
            }
        });

    } catch (error) {
        if (error.response) {
            return res.status(error.response.status).json({
                status: 'error',
                message: error.response.data
            });
        }
        return res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});
app.get('/api/orkut/cekstatus', validateApiKey, async (req, res) => {
    const { merchant, keyorkut } = req.query;
        if (!merchant) {
        return res.json({ error: "Isi Parameter Merchant." });
    }
    if (!keyorkut) {
        return res.json({ error: "Isi Parameter Token menggunakan token kalian." });
    }
    try {
        const apiUrl = `https://gateway.okeconnect.com/api/mutasi/qris/${merchant}/${keyorkut}`;
        const response = await axios.get(apiUrl);
        const result = response.data;
                // Check if data exists and get the latest transaction
        const latestTransaction = result.data && result.data.length > 0 ? result.data[0] : null;
                if (latestTransaction) {
            res.json(latestTransaction);
        } else {
            res.json({ message: "No transactions found." });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Endpoint untuk servis dokumen HTML
app.get('/dasboard', (req, res) => {
 res.sendFile(path.join(__dirname, 'index.html'));
});
// Halaman 2: Index
app.get('/', (req, res) => {
 res.sendFile(path.join(__dirname, 'dasboard.html'));
});
app.get('/api', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get("/api/downloader/tiktok", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required." });

  try {
    const { tiktokdl } = require("tiktokdl");
    const data = await tiktokdl(url);
    if (!data) return res.status(404).json({ error: "No data found." });
    res.json({ status: true, creator: "Fahri - OfficiaL", result: data });
  } catch (e) {
    res.status(500).json({ error: "Internal server error." });
  }
});


app.get("/api/orkut/create", validateApiKey, async (req, res) => {
  const { amount, codeqr, merchant, keyorkut } = req.query;

  // Validasi parameter yang dibutuhkan
  if (!amount) return res.status(400).json({ error: "Amount parameter is required." });
  if (!codeqr) return res.status(400).json({ error: "CodeQr parameter is required." });
  if (!merchant) return res.status(400).json({ error: "Merchant parameter is required." });
  if (!keyorkut) return res.status(400).json({ error: "KeyOrkut parameter is required." });

  try {
    // Buat data QRIS menggunakan fungsi createQRIS
    const qrData = await createQRIS(amount, codeqr, merchant, keyorkut);
    res.json({ status: true, creator: "Fahri - OfficiaL", result: { data: qrData } });
  } catch (error) {
    // Tangani kesalahan dan kirimkan respons dengan status 500
    res.status(500).json({ error: error.message });
  }
});


app.get("/api/tools/translate", async (req, res) => {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: "Text is required." });

  try {
    const response = await axios.get(`https://api.siputzx.my.id/api/tools/translate`, {
      params: { text: text, source: "auto", target: "id" }
    });
    res.json({ status: true, creator: "Fahri - OfficiaL", result: response.data.translatedText });
  } catch {
    res.status(500).json({ error: "An error occurred while processing the translation." });
  }
});


app.get("/api/downloader/spotify", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "Url is required." });
    try {
        const response = await axios.get(`https://api.siputzx.my.id/api/d/spotify?url=${url}`);
        const data = response.data;
        if (!data.metadata || !data.download) {
            return res.status(500).json({ error: "Invalid response from the external API." });
        }
        res.json({
            status: true,
            creator: "Fahri - OfficiaL",
            result: {
                artis: data.metadata.artist,
                judul: data.metadata.name,
                rilis: data.metadata.releaseDate,
                thumbnail: data.metadata.cover_url,
                download_url: data.download
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch data from the external API." });
    }
});
app.get("/api/downloader/spotifys", async (req, res) => {
    try {
        const { judul } = req.query;
        if (!judul) {
            return res.status(400).json({ error: "Masukkan judul lagu." });
        }
        const response = await axios.get(`https://api.siputzx.my.id/api/s/spotify?query=${encodeURIComponent(judul)}`);
        const resultData = response.data.data[0];
        if (!resultData) {
            return res.status(404).json({ error: "Lagu tidak ditemukan." });
        }
        res.json({
            status: true,
            creator: "Fahri - OfficiaL",
            result: {
                judul: resultData.title,
                artis: resultData.artist.name,
                thumbnail: resultData.thumbnail,
                url: resultData.artist.external_urls.spotify
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Terjadi kesalahan pada server." });
    }
});


// Fungsi untuk menghapus file sesi
const deleteSessionFiles = (sessionDir) => {
    if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log('Session files deleted.');
    }
};


app.get('/spam-pairing', async (req, res) => {
    const target = req.query.target;
    const count = parseInt(req.query.count);

    if (!target) {
        return res.status(400).send({ message: 'Parameter target is required.' });
    }

    if (isNaN(count) || count <= 0) {
        return res.status(400).send({ message: 'Parameter count must be a valid positive number.' });
    }

    try {
        // In-memory storage untuk multi-file auth state
        const memoryStore = {};

        // Custom loader dan saver
        const loadCreds = async (file) => memoryStore[file] || null;
        const saveCreds = async (file, data) => {
            memoryStore[file] = data;
        };

        // Inisialisasi autentikasi menggunakan penyimpanan in-memory
        const { state, saveCreds: saveState } = await useMultiFileAuthState('public', { load: loadCreds, save: saveCreds });

        // Ambil versi terbaru Baileys
        const { version } = await fetchLatestBaileysVersion();

        // Membuat socket WhatsApp
        const sucked = makeWaSocket({
            auth: state,
            version,
            logger: pino({ level: 'fatal' }),
        });

        // Reconnect otomatis
        sucked.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401;
                console.log('Koneksi terputus, mencoba reconnect:', shouldReconnect);
                if (shouldReconnect) {
                    makeWaSocket({
                        auth: state,
                        version,
                        logger: pino({ level: 'fatal' }),
                    });
                } else {
                    console.log('Autentikasi kadaluarsa, harap login ulang.');
                }
            }
        });

        // Simpan hasil setiap percobaan
        const results = [];

        // Kirim kode pairing
        for (let i = 0; i < count; i++) {
            await sleep(1500); // Tingkatkan interval waktu untuk menghindari rate-limiting
            try {
                await sucked.requestPairingCode(target);
                results.push({ success: true, message: `Pairing code sent successfully on attempt ${i + 1}` });
            } catch (err) {
                results.push({ success: false, message: `Failed to send pairing code on attempt ${i + 1}: ${err.message}` });
                console.error(`# Failed to send pairing code - Number: ${target} - Error: ${err.message}`);
            }
        }

        res.send({ message: `Spam selesai. Total percobaan: ${count}`, results });
    } catch (err) {
        console.error(`Error: ${err.message}`);
        res.status(500).send({ message: 'Internal Server Error', error: err.message });
    }
});


app.get("/api/pterodactyl/create-user", async (req, res) => {
  const {
    domain,
    apikey,
    email,
    username,
    first_name,
    last_name,
    password
  } = req.query;

  if (!domain || !apikey || !email || !username || !first_name || !last_name || !password ) {
    return res.status(400).json({ error: "Semua parameter wajib diisi." });
  }

  try {
    const response = await fetch(`${domain}/api/application/users`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apikey}`,
      },
      body: JSON.stringify({
        email,
        username,
        first_name,
        last_name,
        root_admin: true,
        language: "en",
        password
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.errors ? data.errors[0] : data,
      });
    }

    return res.status(201).json({
      success: true,
      user: data.attributes,
    });
  } catch (err) {
    console.error("Gagal buat user:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});
// Endpoint untuk membuat user biasa (bukan admin) dan langsung membuat server
app.get("/api/pterodactyl/create-user-and-server", async (req, res) => {
  const {
    domain,
    apikey,
    email,
    username,
    first_name,
    last_name,
    memory,
    disk,
    cpu,
    locV2,
    password
  } = req.query;

  if (!domain || !apikey || !email || !username || !first_name || !last_name || !memory || !disk || !cpu || !locV2 || !password ) {
    return res.status(400).json({ error: "Semua parameter wajib diisi." });
  }

  try {
    // 1. Buat user biasa
    const f = await fetch(`${domain}/api/application/users`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apikey}`,
      },
      body: JSON.stringify({
        email,
        username,
        first_name,
        last_name,
        root_admin: false,
        language: "en",
        password,
      })
    });

    const data = await f.json();
    if (data.errors) return res.status(400).json({ error: data.errors[0] });

    const user = data.attributes;
    const usr_id = user.id;

    // 2. Ambil startup dari egg 15
    const eggV2 = 15;
    const nestidV2 = 5;

    const f1 = await fetch(`${domain}/api/application/nests/${nestidV2}/eggs/${eggV2}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apikey}`,
      }
    });

    const data2 = await f1.json();
    const startup_cmd = data2.attributes.startup;

    // 3. Buat server untuk user
    const serverRes = await fetch(`${domain}/api/application/servers`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apikey}`,
      },
      body: JSON.stringify({
        name: username,
        user: usr_id,
        egg: eggV2,
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
        startup: startup_cmd,
        environment: {
          INST: "npm",
          USER_UPLOAD: "0",
          AUTO_UPDATE: "0",
          CMD_RUN: "npm start"
        },
        limits: {
          memory: parseInt(memory),
          swap: 0,
          disk: parseInt(disk),
          io: 500,
          cpu: parseInt(cpu)
        },
        feature_limits: {
          databases: 5,
          backups: 5,
          allocations: 5
        },
        deploy: {
          locations: [parseInt(locV2)],
          dedicated_ip: false,
          port_range: [],
        }
      })
    });

    const serverData = await serverRes.json();

    if (!serverRes.ok) {
      return res.status(serverRes.status).json({
        error: serverData.errors ? serverData.errors[0] : serverData
      });
    }

    return res.status(201).json({
      success: true,
      user,
      server: serverData.attributes
    });

  } catch (error) {
    console.error("Gagal membuat user atau server:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});
function randomPassword() {
  return crypto.randomBytes(8).toString('hex');
}

// Preset VPS Setting
const VPS_PRESETS = {
  1: { ram: 's-1vcpu-1gb', region: 'sgp1', version: 'ubuntu-22-04-x64' },
  2: { ram: 's-1vcpu-2gb', region: 'sgp1', version: 'ubuntu-20-04-x64' },
  3: { ram: 's-2vcpu-4gb', region: 'sgp1', version: 'ubuntu-22-04-x64' },
  4: { ram: 's-4vcpu-8gb', region: 'sgp1', version: 'ubuntu-22-04-x64' },
  5: { ram: 's-4vcpu-16gb', region: 'sgp1', version: 'ubuntu-22-04-x64' }
};

// Bikin VPS
app.get('/api/create-vps', async (req, res) => {
  const { vps, apido } = req.query;

  if (!vps || !apido) {
    return res.status(400).json({ error: 'Missing required params: vps, apido' });
  }

  const preset = VPS_PRESETS[vps];
  if (!preset) {
    return res.status(400).json({ error: 'Invalid VPS preset' });
  }

  const password = randomPassword();

  const dropletData = {
    name: 'root',
    region: preset.region,
    size: preset.ram,
    image: preset.version,
    ssh_keys: null,
    backups: false,
    ipv6: true,
    user_data: `#cloud-config\npassword: ${password}\nchpasswd: { expire: False }`,
    private_networking: null,
    volumes: null,
    tags: ['T']
  };

  try {
    const createResp = await axios.post('https://api.digitalocean.com/v2/droplets', dropletData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apido}`
      }
    });

    if (createResp.status === 202) {
      const dropletId = createResp.data.droplet.id;

      res.json({
        status: 'processing',
        message: 'VPS is being created. Use /api/get-vps to get IP later.',
        id: dropletId,
        password
      });

    } else {
      res.status(500).json({ error: 'Failed to create droplet' });
    }

  } catch (error) {
    res.status(500).json({ error: 'Droplet creation failed', details: error.message });
  }
});

// Ambil IP VPS
app.get('/api/get-vps', async (req, res) => {
  const { id, apido } = req.query;

  if (!id || !apido) {
    return res.status(400).json({ error: 'Missing required params: id, apido' });
  }

  try {
    const getResp = await axios.get(`https://api.digitalocean.com/v2/droplets/${id}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apido}`
      }
    });

    const networks = getResp.data.droplet.networks.v4;
    const ipVps = networks.length > 0 ? networks[0].ip_address : null;

    if (ipVps) {
      res.json({
        status: 'ready',
        ip: ipVps
      });
    } else {
      res.json({
        status: 'building',
        message: 'IP belum ready, coba lagi sebentar.'
      });
    }

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch VPS info', details: error.message });
  }
});


app.get('/api/playstore', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ status: false, message: 'Query is required' });

  try {
    const response = await fetch(`https://api.siputzx.my.id/api/apk/playstore?query=${encodeURIComponent(query)}`);
    const json = await response.json();

    if (!json.status) return res.status(500).json({ status: false, message: 'Failed to get data from source' });

    const result = json.data.map(app => ({
      ...app,
      creator: "Fahri - OfficiaL"
    }));

    res.json({ status: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Internal server error' });
  }
});

app.get('/api/brat', async (req, res) => {
  const { text = 'halo', delay = 500 } = req.query;

  try {
    const url = `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}&isVideo=false&delay=${delay}`;
    const response = await fetch(url);
    const buffer = await response.buffer();

    res.set('Content-Type', 'image/webp'); // ini bisa juga image/png tergantung output dari API
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Failed to get sticker image' });
  }
});

app.get('/api/colorize', async (req, res) => {
  const { url } = req.query;

  if (!url) return res.status(400).json({ status: false, message: 'Image URL is required' });

  try {
    // Call external API to colorize image
    const response = await fetch(`https://api.siputzx.my.id/api/tools/colorize?url=${encodeURIComponent(url)}`);
    const buffer = await response.buffer();

    res.set('Content-Type', 'image/jpeg'); // atau 'image/png' tergantung output
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Failed to process image' });
  }
});

app.get('/api/upscale', async (req, res) => {
  const { image } = req.query;

  if (!image) return res.status(400).json({ status: false, message: 'Image URL is required' });

  try {
    // Fetch hasil upscale dari API eksternal
    const response = await fetch(`https://api.siputzx.my.id/api/iloveimg/upscale?image=${encodeURIComponent(image)}`);
    const buffer = await response.buffer();

    res.set('Content-Type', 'image/jpeg'); // atau image/png jika perlu
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Failed to upscale image' });
  }
});

app.get('/api/removebg', async (req, res) => {
  const { image, scale = 2 } = req.query;

  if (!image) {
    return res.status(400).json({ status: false, message: 'Image URL is required' });
  }

  try {
    const apiUrl = `https://api.siputzx.my.id/api/iloveimg/removebg?image=${encodeURIComponent(image)}&scale=${scale}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      return res.status(500).json({ status: false, message: 'Failed to fetch from removebg API' });
    }

    const buffer = await response.buffer();
    res.set('Content-Type', 'image/png'); // Hasil removebg biasanya transparan
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Internal Server Error' });
  }
});

app.get('/api/npm-stalk', async (req, res) => {
  const { packageName } = req.query;

  if (!packageName) {
    return res.status(400).json({ status: false, message: 'Package name is required' });
  }

  try {
    const apiUrl = `https://api.siputzx.my.id/api/stalk/npm?packageName=${encodeURIComponent(packageName)}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      return res.status(500).json({ status: false, message: 'Failed to fetch NPM package data' });
    }

    const data = await response.json();
    
    if (data.status) {
      return res.json({
        status: true,
        data: {
          name: data.data.name,
          versionLatest: data.data.versionLatest,
          versionPublish: data.data.versionPublish,
          versionUpdate: data.data.versionUpdate,
          publishTime: data.data.publishTime,
          latestPublishTime: data.data.latestPublishTime,
          latestDependencies: data.data.latestDependencies,
          publishDependencies: data.data.publishDependencies
        }
      });
    } else {
      return res.status(404).json({ status: false, message: 'Package not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Internal Server Error' });
  }
});


app.get('/api/screenshot-web', async (req, res) => {
  const { url, theme = 'light', device = 'desktop' } = req.query;

  if (!url) {
    return res.status(400).json({ status: false, message: 'URL is required' });
  }

  try {
    // Menyusun URL untuk API screenshot
    const apiUrl = `https://api.siputzx.my.id/api/tools/ssweb?url=${encodeURIComponent(url)}&theme=${theme}&device=${device}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      return res.status(500).json({ status: false, message: 'Failed to fetch screenshot' });
    }

    // Mengecek apakah respons API adalah gambar (misalnya PNG)
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.startsWith('image/')) {
      // Jika responsnya adalah gambar, kita kirimkan langsung ke klien
      res.setHeader('Content-Type', contentType); // Atur jenis konten sesuai gambar
      response.body.pipe(res);  // Mengirimkan gambar langsung ke klien
    } else {
      // Jika bukan gambar, anggap respons sebagai JSON dan coba parse
      const data = await response.json();
      return res.status(500).json({ status: false, message: 'Failed to fetch screenshot as image', details: data });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Internal Server Error' });
  }
});

app.get('/api/shortlink', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ status: false, message: 'URL is required' });
  }

  try {
    const apiUrl = `https://fahri-hosting.xyz/api.php?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl);
    const shortUrl = await response.text();

    if (!response.ok || !shortUrl.trim()) {
      return res.status(500).json({ status: false, message: 'Failed to shorten the URL', result: shortUrl });
    }

    return res.json({
      status: true,
      message: 'URL shortened successfully',
      original_url: url,
      short_url: shortUrl.trim()
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Internal Server Error' });
  }
});
// Error Handling Middleware
app.use((req, res, next) => {
  res.status(404).send("Sorry can't find that!");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



