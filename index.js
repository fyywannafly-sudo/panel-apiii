// ================================
// FYY PREMIUM PANEL - index.js
// ================================

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    REST,
    Routes,
} = require('discord.js');
const fs = require('fs');
    const path = require('path');

// ================================
// KONFIGURASI
// ================================

// TODO: GANTI INI PAKAI PUNYA KAMU
const TOKEN = 'MTQ0NTY4OTA5NTE1NzE5MDcyNw.GNRX16.kzHxOVVPWqooBOfihtR3qwHIpi5dW24PayU9N8';              // Token bot
const CLIENT_ID = '1445689095157190727';    // Application ID (di Dev Portal)
const GUILD_ID = '1420156740045111407';         // Server ID tempat bot dipakai
const OWNER_ID = '482045422932590594';        // Discord ID kamu (owner utama)

// File penyimpanan key + role target Get Role
const KEYS_FILE = path.join(__dirname, 'keys.json');

// File penyimpanan config webhook log
const LOG_CONFIG_FILE = path.join(__dirname, 'logConfig.json');

// Admin tambahan selain OWNER_ID (disimpan in-memory)
const extraAdmins = new Set();

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
        console.warn('keys.json tidak ditemukan / rusak, membuat baru...');
        return {
            getRoleTargetRoleId: null,
            keys: [],
        };
    }
}

function saveKeysData() {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keysData, null, 2), 'utf8');
}

let keysData = loadKeysData();

function loadLogConfig() {
    try {
        const raw = fs.readFileSync(LOG_CONFIG_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return { webhookUrl: '' };
    }
}

function saveLogConfig(cfg) {
    fs.writeFileSync(LOG_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

// ================================
// HELPER FUNCTIONS
// ================================

function isAdmin(userId) {
    return userId === OWNER_ID || extraAdmins.has(userId);
}

function generateRandomKey() {
    const part1 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const part2 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const part3 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return `FYY-${part1}-${part2}-${part3}`;
}

function computeExpiry(days) {
    if (!days || days <= 0) return null; // permanent
    const now = new Date();
    now.setUTCDate(now.getUTCDate() + days);
    return now.toISOString();
}

function findKeyObj(keyStr) {
    return keysData.keys.find(
        (k) => k.key.toUpperCase() === keyStr.toUpperCase(),
    );
}

function findKeyByUser(userId) {
    return keysData.keys.find((k) => k.usedBy === userId);
}

// Panel embed ungu cyberpunk
function buildPanelComponents() {
    const embed = new EmbedBuilder()
        .setTitle('⚡ FYY Premium Control Panel')
        .setDescription(
            [
                '>>> 👑 **Welcome to Fyy Premium**',
                '',
                '💳 **Redeem Key** – aktifin akses premium kamu.',
                '🧩 **Get Role** – ambil role premium biar bisa akses channel khusus.',
                '📜 **Get Script** – dapetin script yang sudah include key kamu.',
                'ℹ️ **Check Status** – cek key, HWID, expired, blacklist.',
                '♻ **Reset HWID** – reset HWID lewat panel kalau ganti device.',
                '',
                '🛡️ Semua aktivitas ke‑log di **security webhook**.',
            ].join('\n'),
        )
        .setColor(0x992dff)
        .setFooter({
            text: 'Fyy Premium • Dark Purple Cyberpunk',
        });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('redeem')
            .setLabel('💳 Redeem Key')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('getrole')
            .setLabel('🧩 Get Role')
            .setStyle(ButtonStyle.Success),
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('status')
            .setLabel('ℹ️ Status')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('getscr')
            .setLabel('📜 Get Script')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('reset')
            .setLabel('♻ Reset HWID')
            .setStyle(ButtonStyle.Danger),
    );

    return { embed, rows: [row1, row2] };
}

// Kirim log ke webhook sebagai embed
async function sendPanelLog(client, { title, description, color = 0x992dff, fields = [] }) {
    const cfg = loadLogConfig();
    if (!cfg.webhookUrl) {
        console.log('[PANEL LOG]', title, '-', description);
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
        .addFields(fields);

    try {
        let f = global.fetch;
        if (!f) {
            const mod = await import('node-fetch');
            f = mod.default;
        }

        await f(cfg.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed.toJSON()] }),
        });
    } catch (err) {
        console.error('Gagal kirim panel log webhook:', err);
    }
}

// ================================
// SLASH COMMAND DEFINITIONS
// ================================

const commands = [
    {
        name: 'panel',
        description: 'Tampilkan panel premium (owner only)',
    },
    {
        name: 'addkey',
        description: 'Tambah key baru (admin only)',
        options: [
            {
                name: 'key',
                description: 'Key yang ingin ditambahkan',
                type: 3, // STRING
                required: true,
            },
            {
                name: 'role',
                description: 'Role yang akan dikaitkan ke key ini (opsional)',
                type: 8, // ROLE
                required: false,
            },
            {
                name: 'days',
                description: 'Durasi aktif (hari). Kosongkan untuk permanent.',
                type: 4, // INTEGER
                required: false,
            },
        ],
    },
    {
        name: 'randomkeys',
        description: 'Generate beberapa key random FYY-000-000-000 (admin only)',
        options: [
            {
                name: 'jumlah',
                description: 'Berapa key yang mau dibuat (max 50)',
                type: 4, // INTEGER
                required: true,
            },
            {
                name: 'role',
                description:
                    'Role yang akan dikaitkan ke semua key ini (opsional)',
                type: 8, // ROLE
                required: false,
            },
            {
                name: 'days',
                description: 'Durasi aktif (hari). Kosongkan untuk permanent.',
                type: 4, // INTEGER
                required: false,
            },
        ],
    },
    {
        name: 'keys',
        description: 'Lihat key yang masih tersedia (admin only)',
    },
    {
        name: 'setgetrole',
        description:
            'Set role default untuk tombol Get Role (admin only, dipakai kalau key tidak punya role sendiri)',
        options: [
            {
                name: 'role',
                description: 'Role tujuan default',
                type: 8, // ROLE
                required: true,
            },
        ],
    },
    {
        name: 'whitelist',
        description: 'Whitelist user tanpa redeem key (admin only)',
        options: [
            {
                name: 'user',
                description: 'User yang mau di-whitelist',
                type: 6, // USER
                required: true,
            },
            {
                name: 'role',
                description: 'Role tujuan Get Role untuk user ini (opsional)',
                type: 8, // ROLE
                required: false,
            },
            {
                name: 'days',
                description: 'Durasi aktif (hari). Kosongkan untuk permanent.',
                type: 4, // INTEGER
                required: false,
            },
        ],
    },
    {
        name: 'bulkwhitelist',
        description: 'Whitelist semua member dari role tertentu (admin only)',
        options: [
            {
                name: 'role',
                description: 'Role yang akan di-whitelist membernya',
                type: 8, // ROLE
                required: true,
            },
            {
                name: 'targetrole',
                description:
                    'Role tujuan Get Role (kalau mau beda dengan role sumber)',
                type: 8, // ROLE
                required: false,
            },
            {
                name: 'days',
                description:
                    'Durasi aktif (hari) untuk semua key. Kosongkan untuk permanent.',
                type: 4, // INTEGER
                required: false,
            },
        ],
    },
    {
        name: 'keyinfo',
        description: 'Lihat info detail dari satu key (admin only)',
        options: [
            {
                name: 'key',
                description: 'Key yang ingin dicek',
                type: 3, // STRING
                required: true,
            },
        ],
    },
    {
        name: 'userinfo',
        description: 'Lihat semua key milik seorang user (admin only)',
        options: [
            {
                name: 'user',
                description: 'User yang ingin dicek',
                type: 6, // USER
                required: true,
            },
        ],
    },
    {
        name: 'blacklistkey',
        description: 'Blacklist 1 key sehingga tidak bisa dipakai lagi (admin only)',
        options: [
            {
                name: 'key',
                description: 'Key yang mau diblacklist',
                type: 3, // STRING
                required: true,
            },
            {
                name: 'reason',
                description: 'Alasan (opsional)',
                type: 3, // STRING
                required: false,
            },
        ],
    },
    {
        name: 'unblacklistkey',
        description: 'Unblacklist 1 key (admin only)',
        options: [
            {
                name: 'key',
                description: 'Key yang mau di-unblacklist',
                type: 3, // STRING
                required: true,
            },
        ],
    },
    {
        name: 'blacklistuser',
        description:
            'Blacklist semua key milik user (admin only, level global untuk user tsb)',
        options: [
            {
                name: 'user',
                description: 'User yang mau diblacklist key-keynya',
                type: 6, // USER
                required: true,
            },
            {
                name: 'reason',
                description: 'Alasan (opsional)',
                type: 3, // STRING
                required: false,
            },
        ],
    },
    {
        name: 'unblacklistuser',
        description: 'Unblacklist semua key milik user (admin only)',
        options: [
            {
                name: 'user',
                description: 'User yang mau di-unblacklist key-keynya',
                type: 6, // USER
                required: true,
            },
        ],
    },
    {
        name: 'addadmin',
        description: 'Tambah admin baru yang bisa pakai command premium (owner only)',
        options: [
            {
                name: 'user',
                description: 'User yang mau dijadikan admin',
                type: 6, // USER
                required: true,
            },
        ],
    },
    {
        name: 'admins',
        description: 'Lihat daftar admin (owner & admin)',
    },
    {
        name: 'webhook',
        description: 'Set / cek webhook security logs (admin only)',
        options: [
            {
                name: 'url',
                description: 'Webhook URL (kosongkan kalau cuma mau cek)',
                type: 3, // STRING
                required: false,
            },
        ],
    },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
    try {
        console.log('⏳ Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('✅ Slash commands registered');
    } catch (error) {
        console.error('❌ Error register commands:', error);
    }
}

// ================================
// DISCORD CLIENT
// ================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once('clientReady', async (c) => {
    console.log(`🤖 Bot Online sebagai: ${c.user.tag}`);
    await registerCommands();
});

// ================================
// INTERACTION HANDLER
// ================================

client.on('interactionCreate', async (interaction) => {
    // ======================
    // SLASH COMMANDS
    // ======================
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // /panel
        if (commandName === 'panel') {
            if (interaction.user.id !== OWNER_ID) {
                await interaction.reply({
                    content: '❌ Hanya owner yang bisa mengirim panel.',
                    ephemeral: true,
                });
                return;
            }

            const { embed, rows } = buildPanelComponents();
            await interaction.reply({
                embeds: [embed],
                components: rows,
                ephemeral: false,
            });
        }

        // /addkey
        else if (commandName === 'addkey') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const key = interaction.options.getString('key', true).toUpperCase();
            const role = interaction.options.getRole('role', false);
            const days = interaction.options.getInteger('days', false);
            const expiresAt = computeExpiry(days);

            if (findKeyObj(key)) {
                await interaction.reply({
                    content: `⚠ Key \`${key}\` sudah ada di daftar.`,
                    ephemeral: true,
                });
            } else {
                keysData.keys.push({
                    key,
                    roleId: role ? role.id : null,
                    usedBy: null,
                    hwidResets: 0,
                    hwid: null,
                    expiresAt,
                    blacklisted: false,
                });
                saveKeysData();
                await interaction.reply({
                    content:
                        `✅ Key \`${key}\` berhasil ditambahkan.` +
                        (role
                            ? ` Role terkait: <@&${role.id}>.`
                            : ' (tanpa role khusus, akan pakai role default Get Role jika di-set).') +
                        (expiresAt
                            ? `\n⏱ Kadaluarsa: \`${expiresAt}\` (UTC).`
                            : '\n♾ Key ini **permanent** (tidak punya expired).'),
                    ephemeral: true,
                });
            }
        }

        // /randomkeys
        else if (commandName === 'randomkeys') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            let jumlah = interaction.options.getInteger('jumlah', true);
            const role = interaction.options.getRole('role', false);
            const days = interaction.options.getInteger('days', false);
            const expiresAt = computeExpiry(days);

            if (jumlah <= 0) {
                await interaction.reply({
                    content: '⚠ Jumlah harus lebih dari 0.',
                    ephemeral: true,
                });
                return;
            }
            if (jumlah > 50) jumlah = 50;

            const generated = [];
            for (let i = 0; i < jumlah; i++) {
                let key = generateRandomKey();
                while (findKeyObj(key)) {
                    key = generateRandomKey();
                }
                keysData.keys.push({
                    key,
                    roleId: role ? role.id : null,
                    usedBy: null,
                    hwidResets: 0,
                    hwid: null,
                    expiresAt,
                    blacklisted: false,
                });
                generated.push(key);
            }
            saveKeysData();

            await interaction.reply({
                content:
                    `✅ Berhasil generate **${generated.length}** key:\n` +
                    generated.map((k) => `• \`${k}\``).join('\n') +
                    (role
                        ? `\nSemua key dikaitkan dengan role: <@&${role.id}>.`
                        : '\nSemua key tanpa role khusus (akan pakai role default Get Role jika di-set).') +
                    (expiresAt
                        ? `\n⏱ Semua key akan kadaluarsa: \`${expiresAt}\` (UTC).`
                        : '\n♾ Semua key **permanent** (tidak punya expired).'),
                ephemeral: true,
            });
        }

        // /keys
        else if (commandName === 'keys') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const available = keysData.keys.filter((k) => !k.usedBy && !k.blacklisted);
            if (available.length === 0) {
                await interaction.reply({
                    content:
                        '📭 Tidak ada key yang masih tersedia (semua sudah terpakai atau diblacklist).',
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content:
                        '📋 **Key yang masih tersedia (belum terpakai & tidak diblacklist):**\n' +
                        available
                            .map((k) =>
                                `• \`${k.key}\` ` +
                                (k.roleId ? `(role: <@&${k.roleId}>)` : '(tanpa role khusus)') +
                                (k.expiresAt ? ` | expired: \`${k.expiresAt}\`` : ' | permanent'),
                            )
                            .join('\n'),
                    ephemeral: true,
                });
            }
        }

        // /setgetrole
        else if (commandName === 'setgetrole') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const role = interaction.options.getRole('role', true);
            keysData.getRoleTargetRoleId = role.id;
            saveKeysData();

            await interaction.reply({
                content: `✅ Role default untuk tombol **Get Role** sekarang: <@&${role.id}>`,
                ephemeral: true,
            });
        }

        // /whitelist
        else if (commandName === 'whitelist') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const targetUser = interaction.options.getUser('user', true);
            const role = interaction.options.getRole('role', false);
            const days = interaction.options.getInteger('days', false);
            const expiresAt = computeExpiry(days);

            const existing = findKeyByUser(targetUser.id);
            if (existing) {
                await interaction.reply({
                    content:
                        `ℹ️ ${targetUser.tag} sudah punya key terikat: \`${existing.key}\`` +
                        (existing.roleId ? ` (role: <@&${existing.roleId}>)` : '') +
                        (existing.expiresAt ? ` | expired: \`${existing.expiresAt}\`` : ''),
                    ephemeral: true,
                });
                return;
            }

            let key = generateRandomKey();
            while (findKeyObj(key)) {
                key = generateRandomKey();
            }

            keysData.keys.push({
                key,
                roleId: role ? role.id : null,
                usedBy: targetUser.id,
                hwidResets: 0,
                hwid: null,
                expiresAt,
                blacklisted: false,
            });
            saveKeysData();

            await interaction.reply({
                content:
                    `✅ ${targetUser.tag} berhasil di-whitelist.\n` +
                    `Key terikat ke akun dia: \`${key}\`` +
                    (role
                        ? `\nRole Get Role (khusus key ini): <@&${role.id}>`
                        : '\nRole Get Role akan pakai role default (kalau sudah di-set).') +
                    (expiresAt
                        ? `\n⏱ Key expired: \`${expiresAt}\` (UTC).`
                        : '\n♾ Key ini **permanent**.'),
                ephemeral: true,
            });

            await sendPanelLog(interaction.client, {
                title: '🟢 WHITELIST',
                description: `User <@${targetUser.id}> di-whitelist oleh <@${interaction.user.id}>`,
                fields: [
                    { name: 'Key', value: `\`${key}\``, inline: true },
                    {
                        name: 'Role',
                        value: role ? `<@&${role.id}>` : 'Default panel',
                        inline: true,
                    },
                    {
                        name: 'Expired',
                        value: expiresAt || 'Permanent',
                        inline: true,
                    },
                ],
            });
        }

        // /bulkwhitelist
        else if (commandName === 'bulkwhitelist') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const sourceRole = interaction.options.getRole('role', true);
            const targetRole = interaction.options.getRole('targetrole', false);
            const days = interaction.options.getInteger('days', false);
            const expiresAt = computeExpiry(days);

            const guild = interaction.guild;
            if (!guild) {
                await interaction.reply({
                    content: '❌ Hanya bisa digunakan di dalam server.',
                    ephemeral: true,
                });
                return;
            }

            const members = sourceRole.members.filter((m) => !m.user.bot);
            let created = 0;

            for (const member of members.values()) {
                if (findKeyByUser(member.id)) continue;

                let key = generateRandomKey();
                while (findKeyObj(key)) {
                    key = generateRandomKey();
                }

                keysData.keys.push({
                    key,
                    roleId: targetRole ? targetRole.id : sourceRole.id,
                    usedBy: member.id,
                    hwidResets: 0,
                    hwid: null,
                    expiresAt,
                    blacklisted: false,
                });
                created++;
            }

            if (created > 0) {
                saveKeysData();
            }

            await interaction.reply({
                content:
                    `✅ Bulk whitelist selesai.\n` +
                    `Role sumber: <@&${sourceRole.id}>\n` +
                    (targetRole
                        ? `Role Get Role: <@&${targetRole.id}>\n`
                        : `Role Get Role: <@&${sourceRole.id}>\n`) +
                    `Member di-whitelist baru: **${created}**` +
                    (expiresAt
                        ? `\n⏱ Key akan expired: \`${expiresAt}\` (UTC).`
                        : '\n♾ Key ditandai **permanent**.'),
                ephemeral: true,
            });

            await sendPanelLog(interaction.client, {
                title: '🟢 BULK WHITELIST',
                description: `Bulk whitelist dijalankan oleh <@${interaction.user.id}>`,
                fields: [
                    { name: 'Role sumber', value: `<@&${sourceRole.id}>`, inline: true },
                    {
                        name: 'Role Get Role',
                        value: targetRole
                            ? `<@&${targetRole.id}>`
                            : `<@&${sourceRole.id}>`,
                        inline: true,
                    },
                    {
                        name: 'User baru',
                        value: String(created),
                        inline: true,
                    },
                    {
                        name: 'Expired',
                        value: expiresAt || 'Permanent',
                        inline: true,
                    },
                ],
            });
        }

        // /keyinfo
        else if (commandName === 'keyinfo') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const keyStr = interaction.options.getString('key', true).toUpperCase();
            const keyObj = findKeyObj(keyStr);

            if (!keyObj) {
                await interaction.reply({
                    content: `❌ Key \`${keyStr}\` tidak ditemukan di database.`,
                    ephemeral: true,
                });
                return;
            }

            const lines = [
                `🔑 **Key:** \`${keyObj.key}\``,
                `👤 UsedBy (Discord): ${
                    keyObj.usedBy ? `<@${keyObj.usedBy}>` : 'belum terikat'
                }`,
                `🧩 Role: ${keyObj.roleId ? `<@&${keyObj.roleId}>` : 'default/panel'}`,
                `💻 HWID: \`${keyObj.hwid || 'belum di-bind'}\``,
                `♻ Total Reset HWID: **${keyObj.hwidResets ?? 0}**`,
                `⏱ Expired: ${keyObj.expiresAt ? `\`${keyObj.expiresAt}\`` : 'permanent'}`,
                `⛔ Blacklisted: **${keyObj.blacklisted ? 'YA' : 'TIDAK'}**`,
            ];

            await interaction.reply({
                content: lines.join('\n'),
                ephemeral: true,
            });
        }

        // /userinfo
        else if (commandName === 'userinfo') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const user = interaction.options.getUser('user', true);
            const owned = keysData.keys.filter((k) => k.usedBy === user.id);

            if (owned.length === 0) {
                await interaction.reply({
                    content: `ℹ️ ${user.tag} belum punya key yang terikat.`,
                    ephemeral: true,
                });
                return;
            }

            const lines = owned.map((k) => {
                return (
                    `• \`${k.key}\` | role: ${
                        k.roleId ? `<@&${k.roleId}>` : 'default/panel'
                    } | HWID: \`${k.hwid || 'belum di-bind'}\` | reset: **${
                        k.hwidResets ?? 0
                    }** | expired: ${
                        k.expiresAt ? `\`${k.expiresAt}\`` : 'permanent'
                    } | blacklisted: **${k.blacklisted ? 'YA' : 'TIDAK'}**`
                );
            });

            await interaction.reply({
                content:
                    `👤 Info key untuk ${user.tag} (<@${user.id}>):\n` +
                    lines.join('\n'),
                ephemeral: true,
            });
        }

        // /blacklistkey
        else if (commandName === 'blacklistkey') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const keyStr = interaction.options.getString('key', true).toUpperCase();
            const reason = interaction.options.getString('reason', false) || 'tanpa alasan';
            const keyObj = findKeyObj(keyStr);

            if (!keyObj) {
                await interaction.reply({
                    content: `❌ Key \`${keyStr}\` tidak ditemukan.`,
                    ephemeral: true,
                });
                return;
            }

            keyObj.blacklisted = true;
            saveKeysData();

            await interaction.reply({
                content: `⛔ Key \`${keyObj.key}\` sekarang **BLACKLISTED**.\nAlasan: ${reason}`,
                ephemeral: true,
            });

            await sendPanelLog(interaction.client, {
                title: '⛔ BLACKLIST KEY',
                description: `Key diblacklist oleh <@${interaction.user.id}>`,
                fields: [
                    { name: 'Key', value: `\`${keyObj.key}\``, inline: true },
                    {
                        name: 'User',
                        value: keyObj.usedBy ? `<@${keyObj.usedBy}>` : 'belum terikat',
                        inline: true,
                    },
                    { name: 'Reason', value: reason, inline: false },
                ],
                color: 0xff4d4d,
            });
        }

        // /unblacklistkey
        else if (commandName === 'unblacklistkey') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const keyStr = interaction.options.getString('key', true).toUpperCase();
            const keyObj = findKeyObj(keyStr);

            if (!keyObj) {
                await interaction.reply({
                    content: `❌ Key \`${keyStr}\` tidak ditemukan.`,
                    ephemeral: true,
                });
                return;
            }

            keyObj.blacklisted = false;
            saveKeysData();

            await interaction.reply({
                content: `✅ Key \`${keyObj.key}\` sekarang **TIDAK** diblacklist lagi.`,
                ephemeral: true,
            });

            await sendPanelLog(interaction.client, {
                title: '✅ UNBLACKLIST KEY',
                description: `Key di-unblacklist oleh <@${interaction.user.id}>`,
                fields: [
                    { name: 'Key', value: `\`${keyObj.key}\``, inline: true },
                    {
                        name: 'User',
                        value: keyObj.usedBy ? `<@${keyObj.usedBy}>` : 'belum terikat',
                        inline: true,
                    },
                ],
                color: 0x68ff8b,
            });
        }

        // /blacklistuser
        else if (commandName === 'blacklistuser') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const user = interaction.options.getUser('user', true);
            const reason = interaction.options.getString('reason', false) || 'tanpa alasan';

            let count = 0;
            for (const k of keysData.keys) {
                if (k.usedBy === user.id) {
                    if (!k.blacklisted) {
                        k.blacklisted = true;
                        count++;
                    }
                }
            }
            if (count > 0) saveKeysData();

            await interaction.reply({
                content:
                    `⛔ User ${user.tag} (<@${user.id}>) sekarang diblacklist pada **${count}** key.\nAlasan: ${reason}`,
                ephemeral: true,
            });

            await sendPanelLog(interaction.client, {
                title: '⛔ BLACKLIST USER',
                description: `User diblacklist oleh <@${interaction.user.id}>`,
                fields: [
                    { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
                    { name: 'Total key diblacklist', value: String(count), inline: true },
                    { name: 'Reason', value: reason, inline: false },
                ],
                color: 0xff4d4d,
            });
        }

        // /unblacklistuser
        else if (commandName === 'unblacklistuser') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const user = interaction.options.getUser('user', true);

            let count = 0;
            for (const k of keysData.keys) {
                if (k.usedBy === user.id && k.blacklisted) {
                    k.blacklisted = false;
                    count++;
                }
            }
            if (count > 0) saveKeysData();

            await interaction.reply({
                content:
                    `✅ User ${user.tag} (<@${user.id}>) di-unblacklist pada **${count}** key.`,
                ephemeral: true,
            });

            await sendPanelLog(interaction.client, {
                title: '✅ UNBLACKLIST USER',
                description: `User di-unblacklist oleh <@${interaction.user.id}>`,
                fields: [
                    { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
                    { name: 'Total key di-unblacklist', value: String(count), inline: true },
                ],
                color: 0x68ff8b,
            });
        }

        // /addadmin
        else if (commandName === 'addadmin') {
            if (interaction.user.id !== OWNER_ID) {
                await interaction.reply({
                    content: '❌ Hanya owner yang bisa menambah admin.',
                    ephemeral: true,
                });
                return;
            }

            const user = interaction.options.getUser('user', true);
            if (user.id === OWNER_ID) {
                await interaction.reply({
                    content: '⚠ Owner sudah otomatis admin.',
                    ephemeral: true,
                });
                return;
            }

            if (extraAdmins.has(user.id)) {
                await interaction.reply({
                    content: `⚠ ${user.tag} sudah jadi admin.`,
                    ephemeral: true,
                });
                return;
            }

            extraAdmins.add(user.id);
            await interaction.reply({
                content: `✅ ${user.tag} sekarang jadi admin dan bisa pakai command premium.`,
                ephemeral: true,
            });
        }

        // /admins
        else if (commandName === 'admins') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const list = [
                `• Owner: <@${OWNER_ID}>`,
                ...Array.from(extraAdmins).map((id) => `• Admin: <@${id}>`),
            ];

            await interaction.reply({
                content: '👑 **Daftar admin premium:**\n' + list.join('\n'),
                ephemeral: true,
            });
        }

        // /webhook
        else if (commandName === 'webhook') {
            if (!isAdmin(interaction.user.id)) {
                await interaction.reply({
                    content: '❌ Kamu tidak punya akses untuk command ini.',
                    ephemeral: true,
                });
                return;
            }

            const url = interaction.options.getString('url', false);
            const cfg = loadLogConfig();

            if (!url) {
                await interaction.reply({
                    content:
                        cfg.webhookUrl && cfg.webhookUrl !== ''
                            ? `🔗 Webhook logs saat ini:\n\`${cfg.webhookUrl}\``
                            : 'ℹ️ Belum ada webhook yang di-set. Gunakan `/webhook url:<link>` untuk mengatur.',
                    ephemeral: true,
                });
                return;
            }

            if (!url.startsWith('https://discord.com/api/webhooks/')) {
                await interaction.reply({
                    content: '⚠ URL webhook tidak valid. Harus link webhook Discord.',
                    ephemeral: true,
                });
                return;
            }

            cfg.webhookUrl = url.trim();
            saveLogConfig(cfg);

            await interaction.reply({
                content: '✅ Webhook security logs berhasil di-set.',
                ephemeral: true,
            });
        }

        return;
    }

    // ======================
    // BUTTON HANDLER
    // ======================
    if (interaction.isButton()) {
        const userId = interaction.user.id;
        const guild = interaction.guild;
        let member = null;

        if (guild) {
            try {
                member = await guild.members.fetch(userId);
            } catch (err) {
                console.error('Gagal fetch member:', err);
            }
        }

        // Redeem: siapa saja boleh buka modal
        if (interaction.customId === 'redeem') {
            const modal = new ModalBuilder()
                .setCustomId('redeemModal')
                .setTitle('Redeem Premium Key');

            const keyInput = new TextInputBuilder()
                .setCustomId('licenseKey')
                .setLabel('Masukkan key kamu')
                .setPlaceholder('Contoh: FYY-000-000-000')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(keyInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
            return;
        }

        // Get Role
        if (interaction.customId === 'getrole') {
            if (!guild || !member) {
                await interaction.reply({
                    content: '❌ Hanya bisa digunakan di dalam server.',
                    ephemeral: true,
                });
                return;
            }

            const userKey = findKeyByUser(userId);
            if (!userKey) {
                await interaction.reply({
                    content:
                        '❌ Kamu belum punya key yang terikat. Redeem key dulu atau tunggu di-whitelist.',
                    ephemeral: true,
                });
                return;
            }

            if (userKey.blacklisted) {
                await interaction.reply({
                    content:
                        '⛔ Key kamu diblacklist. Hubungi owner / admin untuk info lebih lanjut.',
                    ephemeral: true,
                });
                return;
            }

            if (userKey.expiresAt) {
                const now = new Date();
                const exp = new Date(userKey.expiresAt);
                if (!isNaN(exp.getTime()) && exp < now) {
                    await interaction.reply({
                        content: '⌛ Key kamu sudah expired. Hubungi owner untuk perpanjang / beli lagi.',
                        ephemeral: true,
                    });
                    return;
                }
            }

            const targetRoleId = userKey.roleId || keysData.getRoleTargetRoleId;
            if (!targetRoleId) {
                await interaction.reply({
                    content:
                        '⚠ Belum ada role tujuan untuk Get Role.\nAdmin bisa set dengan `/setgetrole <role>` atau set role per key di `/addkey` / `/randomkeys` / `/whitelist`.',
                    ephemeral: true,
                });
                return;
            }

            const role = guild.roles.cache.get(targetRoleId);
            if (!role) {
                await interaction.reply({
                    content:
                        '⚠ Role yang dikaitkan tidak ditemukan di server. Cek lagi pengaturan role.',
                    ephemeral: true,
                });
                return;
            }

            if (member.roles.cache.has(role.id)) {
                await interaction.reply({
                    content: `ℹ Kamu sudah punya role <@&${role.id}>.`,
                    ephemeral: true,
                });
                return;
            }

            try {
                await member.roles.add(role);
                await interaction.reply({
                    content: `✅ Role <@&${role.id}> berhasil diberikan ke kamu.`,
                    ephemeral: true,
                });
            } catch (err) {
                console.error('Gagal memberi role via Get Role:', err);
                await interaction.reply({
                    content:
                        '❌ Gagal memberi role. Pastikan bot punya izin **Manage Roles** dan role bot berada di atas role target.',
                    ephemeral: true,
                });
            }

            return;
        }

        // Status / Get Script / Reset HWID
        const userKey = findKeyByUser(userId);

        if (interaction.customId === 'status') {
            if (!userKey) {
                await interaction.reply({
                    content: '❌ Kamu belum redeem key / di-whitelist.',
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content:
                        `✅ Kamu sudah punya key: \`${userKey.key}\`` +
                        (userKey.roleId ? ` (role: <@&${userKey.roleId}>)` : '') +
                        `\n💻 HWID: \`${userKey.hwid || 'belum di-bind'}\`` +
                        `\n♻ Total reset HWID: **${userKey.hwidResets ?? 0}**` +
                        `\n⏱ Expired: ${
                            userKey.expiresAt ? `\`${userKey.expiresAt}\`` : 'permanent'
                        }` +
                        `\n⛔ Blacklisted: **${userKey.blacklisted ? 'YA' : 'TIDAK'}**`,
                    ephemeral: true,
                });
            }
        } else if (interaction.customId === 'getscr') {
            if (!userKey) {
                await interaction.reply({
                    content:
                        '⚠ Data kamu belum ada. Pastikan sudah redeem key dulu atau di-whitelist.',
                    ephemeral: true,
                });
                return;
            }

            if (userKey.blacklisted) {
                await interaction.reply({
                    content:
                        '⛔ Key kamu diblacklist. Script tidak bisa dijalankan. Hubungi owner / admin.',
                    ephemeral: true,
                });
                return;
            }

            if (userKey.expiresAt) {
                const now = new Date();
                const exp = new Date(userKey.expiresAt);
                if (!isNaN(exp.getTime()) && exp < now) {
                    await interaction.reply({
                        content:
                            '⌛ Key kamu sudah expired. Script tidak bisa dijalankan. Hubungi owner untuk perpanjang / beli lagi.',
                        ephemeral: true,
                    });
                    return;
                }
            }

            const script =
                `_G.script_key = "${userKey.key}"\n` +
                `loadstring(game:HttpGet("https://raw.githubusercontent.com/fyywannafly-sudo/FyyCommunity/refs/heads/main/FISHIT%20LOADER"))()`;

            await interaction.reply({
                content: `📜 **Script Premium (pakai key kamu):**\n\`\`\`lua\n${script}\n\`\`\``,
                ephemeral: true,
            });
        } else if (interaction.customId === 'reset') {
            if (!userKey) {
                await interaction.reply({
                    content:
                        '❌ Kamu belum punya key yang terikat, tidak ada HWID yang perlu direset.',
                    ephemeral: true,
                });
                return;
            }

            userKey.hwidResets = (userKey.hwidResets ?? 0) + 1;
            userKey.hwid = null; // biar di-bind ulang di device baru oleh API
            saveKeysData();

            await interaction.reply({
                content:
                    '♻ HWID kamu sudah direset.\nSekarang kamu bisa menjalankan script di device baru, dan HWID akan diikat ulang ke device tersebut.\nKey tetap milik akun kamu.',
                ephemeral: true,
            });

            await sendPanelLog(interaction.client, {
                title: '♻ RESET HWID',
                description: `User <@${interaction.user.id}> melakukan reset HWID`,
                fields: [
                    { name: 'Key', value: `\`${userKey.key}\``, inline: true },
                    {
                        name: 'Total reset',
                        value: String(userKey.hwidResets ?? 0),
                        inline: true,
                    },
                ],
                color: 0xffcc00,
            });
        }

        return;
    }

    // ======================
    // MODAL SUBMIT HANDLER
    // ======================
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'redeemModal') {
            const userId = interaction.user.id;
            const keyStr = interaction.fields
                .getTextInputValue('licenseKey')
                .trim()
                .toUpperCase();

            const existing = findKeyByUser(userId);
            if (existing) {
                await interaction.reply({
                    content:
                        `⚠ Kamu sudah punya key terikat: \`${existing.key}\`.\nKalau mau pindah device, pakai tombol **Reset HWID**.`,
                    ephemeral: true,
                });
                return;
            }

            const keyObj = findKeyObj(keyStr);
            if (!keyObj) {
                await interaction.reply({
                    content: '❌ Key tidak ditemukan di database / tidak valid.',
                    ephemeral: true,
                });
                return;
            }

            if (keyObj.usedBy && keyObj.usedBy !== userId) {
                await interaction.reply({
                    content:
                        '❌ Key ini sudah terikat ke akun lain. Tidak bisa digunakan lagi.',
                    ephemeral: true,
                });
                return;
            }

            if (keyObj.blacklisted) {
                await interaction.reply({
                    content:
                        '⛔ Key ini diblacklist. Hubungi owner / admin untuk info lebih lanjut.',
                    ephemeral: true,
                });
                return;
            }

            if (keyObj.expiresAt) {
                const now = new Date();
                const exp = new Date(keyObj.expiresAt);
                if (!isNaN(exp.getTime()) && exp < now) {
                    await interaction.reply({
                        content:
                            '⌛ Key ini sudah expired. Hubungi owner untuk perpanjang / beli lagi.',
                        ephemeral: true,
                    });
                    return;
                }
            }

            keyObj.usedBy = userId;
            keyObj.hwidResets = keyObj.hwidResets ?? 0;
            // hwid tetap null, nanti di-bind pertama kali di server API
            saveKeysData();

            await interaction.reply({
                content:
                    `✅ Redeem berhasil! Key \`${keyObj.key}\` sekarang terikat ke akun kamu.\n` +
                    'Gunakan tombol **Get Script** untuk ambil script yang sudah include key kamu.',
                ephemeral: true,
            });

            await sendPanelLog(interaction.client, {
                title: '💳 REDEEM KEY',
                description: `User <@${userId}> berhasil redeem key`,
                fields: [
                    { name: 'Key', value: `\`${keyObj.key}\``, inline: true },
                    {
                        name: 'Expired',
                        value: keyObj.expiresAt || 'Permanent',
                        inline: true,
                    },
                ],
                color: 0x68ff8b,
            });
        }
    }
});

// ================================
// LOGIN
// ================================

client.login(TOKEN);

