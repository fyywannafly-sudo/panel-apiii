// ================================
// FYY PREMIUM API SERVER - server.js
// ================================

const express = require('express');
const fs = require('fs');
const path = require('path');

// ================================
// CONFIG
// ================================

// Port lokal API (samain sama yang kamu pakai di ngrok)
const PORT = 3000;

// Lokasi keys.json (sama dengan index.js)
const KEYS_FILE = path.join(__dirname, 'keys.json');

// Lokasi config webhook log (sama dengan index.js)
const LOG_CONFIG_FILE = path.join(__dirname, 'logConfig.json');

// ================================
// LOAD / SAVE DATA
// ================================

function loadKeysData() {
    try {
        const raw = fs.readFileSync(KEYS_FILE, 'utf8');
        const json = JSON.parse(raw);

        if (!('getRoleTargetRoleId' in json)) {
            json.getRoleTargetRoleId = null;
        }

        json.keys = (json.keys || []).map((k) => ({
            key: String(k.key).toUpperCase(),
            roleId: k.roleId ?? null,
            usedBy: k.usedBy ?? null,
            hwidResets: k.hwidResets ?? 0,
            hwid: k.hwid ?? null,
            expiresAt: k.expiresAt ?? null,
            blacklisted: k.blacklisted ?? false,
        }));

        return json;
    } catch (err) {
        console.error('keys.json tidak bisa dibaca, membuat baru:', err);
        return {
            getRoleTargetRoleId: null,
            keys: [],
        };
    }
}

function saveKeysData(data) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

let keysData = loadKeysData();

function findKeyObj(keyStr) {
    return keysData.keys.find(
        (k) => k.key.toUpperCase() === keyStr.toUpperCase(),
    );
}

function loadLogConfig() {
    try {
        const raw = fs.readFileSync(LOG_CONFIG_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return { webhookUrl: '' };
    }
}

// Kirim log ke webhook sebagai embed
async function postWebhookEmbed({ title, description, color = 0x992dff, fields = [] }) {
    const cfg = loadLogConfig();
    const DISCORD_WEBHOOK_URL = cfg.webhookUrl;
    if (!DISCORD_WEBHOOK_URL) {
        console.log('[API LOG]', title, '-', description);
        return;
    }

    const embed = {
        title,
        description,
        color,
        timestamp: new Date().toISOString(),
        fields,
    };

    try {
        let f = global.fetch;
        if (!f) {
            const mod = await import('node-fetch');
            f = mod.default;
        }

        await f(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] }),
        });
    } catch (err) {
        console.error('Gagal kirim log ke webhook:', err);
    }
}

// ================================
// EXPRESS APP
// ================================

const app = express();
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Fyy API server jalan' });
});

/**
 * Endpoint utama:
 * GET /validate?key=...&hwid=...&robloxId=...&placeId=...
 */
app.get('/validate', async (req, res) => {
    const keyStr = (req.query.key || '').toString().toUpperCase();
    const hwid = (req.query.hwid || '').toString();
    const robloxId = (req.query.robloxId || '').toString();
    const placeId = (req.query.placeId || '').toString();

    if (!keyStr || !hwid) {
        await postWebhookEmbed({
            title: '⚠ MISSING PARAMS',
            description: 'Request ke /validate tanpa key atau hwid.',
            color: 0xffcc00,
            fields: [
                { name: 'key', value: '`' + (keyStr || 'kosong') + '`', inline: true },
                { name: 'hwid', value: '`' + (hwid || 'kosong') + '`', inline: true },
                { name: 'robloxId', value: robloxId || 'UNKNOWN', inline: true },
                { name: 'placeId', value: placeId || 'UNKNOWN', inline: true },
            ],
        });

        return res.status(400).json({
            status: 'error',
            code: 'MISSING_PARAMS',
            message: 'key & hwid wajib diisi',
        });
    }

    // Reload keys tiap request biar selalu sync sama bot
    keysData = loadKeysData();
    const keyObj = findKeyObj(keyStr);

    // ================================
    // INVALID KEY
    // ================================
    if (!keyObj) {
        await postWebhookEmbed({
            title: '❌ INVALID KEY',
            description: 'Percobaan memakai key yang tidak ada di database.',
            color: 0xff4d4d,
            fields: [
                { name: 'Key', value: '`' + keyStr + '`', inline: true },
                { name: 'HWID', value: '`' + hwid + '`', inline: true },
                { name: 'RobloxId', value: robloxId || 'UNKNOWN', inline: true },
                { name: 'PlaceId', value: placeId || 'UNKNOWN', inline: true },
            ],
        });

        return res.json({
            status: 'error',
            code: 'INVALID_KEY',
            message: 'Key tidak ditemukan',
        });
    }

    // ================================
    // BLACKLISTED
    // ================================
    if (keyObj.blacklisted) {
        await postWebhookEmbed({
            title: '⛔ BLACKLISTED KEY USED',
            description: 'Key diblacklist tapi masih dicoba dipakai.',
            color: 0xff0000,
            fields: [
                { name: 'Key', value: '`' + keyObj.key + '`', inline: true },
                {
                    name: 'UsedBy (Discord)',
                    value: keyObj.usedBy ? `<@${keyObj.usedBy}>` : 'UNKNOWN',
                    inline: true,
                },
                { name: 'HWID', value: '`' + hwid + '`', inline: false },
                { name: 'RobloxId', value: robloxId || 'UNKNOWN', inline: true },
                { name: 'PlaceId', value: placeId || 'UNKNOWN', inline: true },
            ],
        });

        return res.json({
            status: 'error',
            code: 'BLACKLISTED',
            message: 'Key ini diblacklist. Hubungi owner.',
        });
    }

    // ================================
    // EXPIRED
    // ================================
    if (keyObj.expiresAt) {
        const now = new Date();
        const exp = new Date(keyObj.expiresAt);
        if (!isNaN(exp.getTime()) && exp < now) {
            await postWebhookEmbed({
                title: '⌛ EXPIRED KEY USED',
                description: 'Key yang sudah expired masih dicoba dipakai.',
                color: 0xffaa00,
                fields: [
                    { name: 'Key', value: '`' + keyObj.key + '`', inline: true },
                    {
                        name: 'Expired at',
                        value: '`' + keyObj.expiresAt + '`',
                        inline: true,
                    },
                    {
                        name: 'UsedBy (Discord)',
                        value: keyObj.usedBy ? `<@${keyObj.usedBy}>` : 'UNKNOWN',
                        inline: true,
                    },
                    { name: 'HWID', value: '`' + hwid + '`', inline: false },
                    { name: 'RobloxId', value: robloxId || 'UNKNOWN', inline: true },
                    { name: 'PlaceId', value: placeId || 'UNKNOWN', inline: true },
                ],
            });

            return res.json({
                status: 'error',
                code: 'EXPIRED',
                message: 'Key sudah expired.',
            });
        }
    }

    // ================================
    // HWID LOGIC
    // (TIDAK ADA AUTO PINDAH, HARUS RESET PANEL)
    // ================================

    // Pertama kali dipakai → bind HWID
    if (!keyObj.hwid) {
        keyObj.hwid = hwid;
        saveKeysData(keysData);

        await postWebhookEmbed({
            title: '✅ FIRST BIND',
            description: 'Key pertama kali di-bind ke HWID.',
            color: 0x68ff8b,
            fields: [
                { name: 'Key', value: '`' + keyObj.key + '`', inline: true },
                { name: 'HWID', value: '`' + hwid + '`', inline: false },
                {
                    name: 'UsedBy (Discord)',
                    value: keyObj.usedBy ? `<@${keyObj.usedBy}>` : 'UNKNOWN',
                    inline: true,
                },
                { name: 'RobloxId', value: robloxId || 'UNKNOWN', inline: true },
                { name: 'PlaceId', value: placeId || 'UNKNOWN', inline: true },
            ],
        });

        return res.json({
            status: 'ok',
            code: 'FIRST_BIND',
            message: 'Key valid & HWID pertama kali diikat',
        });
    }

    // HWID sama → OK
    if (keyObj.hwid === hwid) {
        await postWebhookEmbed({
            title: '▶️ EXECUTE',
            description: 'Script dieksekusi dengan HWID yang cocok.',
            color: 0x6b8cff,
            fields: [
                { name: 'Key', value: '`' + keyObj.key + '`', inline: true },
                { name: 'HWID', value: '`' + hwid + '`', inline: false },
                {
                    name: 'UsedBy (Discord)',
                    value: keyObj.usedBy ? `<@${keyObj.usedBy}>` : 'UNKNOWN',
                    inline: true,
                },
                { name: 'RobloxId', value: robloxId || 'UNKNOWN', inline: true },
                { name: 'PlaceId', value: placeId || 'UNKNOWN', inline: true },
            ],
        });

        return res.json({
            status: 'ok',
            code: 'OK',
            message: 'Key valid & HWID cocok',
        });
    }

    // HWID beda → SELALU DITOLAK (nggak ada auto pindah HWID)
    await postWebhookEmbed({
        title: '🚫 HWID MISMATCH',
        description:
            'Key dipakai di device berbeda tanpa reset HWID dari panel.',
        color: 0xffaa00,
        fields: [
            { name: 'Key', value: '`' + keyObj.key + '`', inline: true },
            {
                name: 'HWID Terdaftar',
                value: '`' + (keyObj.hwid || 'null') + '`',
                inline: false,
            },
            { name: 'HWID Baru', value: '`' + hwid + '`', inline: false },
            {
                name: 'UsedBy (Discord)',
                value: keyObj.usedBy ? `<@${keyObj.usedBy}>` : 'UNKNOWN',
                inline: true,
            },
            { name: 'RobloxId', value: robloxId || 'UNKNOWN', inline: true },
            { name: 'PlaceId', value: placeId || 'UNKNOWN', inline: true },
        ],
    });

    return res.json({
        status: 'error',
        code: 'HWID_MISMATCH',
        message:
            'HWID tidak cocok. Kamu harus Reset HWID lewat panel dulu sebelum pindah device.',
    });
});

// ================================
// START SERVER
// ================================

app.listen(PORT, () => {
    console.log(`✅ API server jalan di http://localhost:${PORT}`);
    console.log('   Pakai ngrok: ngrok http ' + PORT);
});
