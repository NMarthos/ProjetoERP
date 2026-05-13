/**
 * Serviço de integração com o Google Drive.
 * Cria pastas automaticamente para cada proposta gerada no ERP.
 *
 * SETUP necessário:
 * 1. Crie um projeto no Google Cloud Console: https://console.cloud.google.com/
 * 2. Ative a API do Google Drive para o projeto.
 * 3. Crie uma "Service Account" e baixe o arquivo JSON de credenciais.
 * 4. Salve o arquivo como: backend/src/config/google-service-account.json
 * 5. Crie uma pasta raiz no Google Drive (ex: "ERP - Propostas").
 * 6. Compartilhe com o e-mail da Service Account como Editor.
 * 7. Copie o ID da pasta (parte final da URL) e defina em backend/.env como GOOGLE_DRIVE_FOLDER_ID
 */

const path = require('path');
const fs = require('fs');

const KEY_FILE_PATH = path.join(__dirname, 'google-service-account.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Verifica se a integração com o Google Drive está totalmente configurada.
 */
function isDriveConfigured() {
    const hasKeyFile = fs.existsSync(KEY_FILE_PATH);
    const hasFolderId = !!(process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();

    if (!hasKeyFile) {
        console.warn('[GOOGLE DRIVE] Arquivo de credenciais não encontrado em:', KEY_FILE_PATH);
    }
    if (!hasFolderId) {
        console.warn('[GOOGLE DRIVE] Variável GOOGLE_DRIVE_FOLDER_ID não definida no .env');
    }

    return hasKeyFile && hasFolderId;
}

/**
 * Cria uma pasta no Google Drive dentro da pasta pai configurada.
 * @param {string} folderName - Nome da pasta a ser criada.
 * @returns {Promise<{id: string, webViewLink: string}|null>}
 */
async function createProposalFolder(folderName) {
    if (!isDriveConfigured()) {
        return null;
    }

    try {
        // Require lazy para não travar o servidor se o pacote não estiver instalado
        const { google } = require('googleapis');

        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_FILE_PATH,
            scopes: SCOPES,
        });

        const drive = google.drive({ version: 'v3', auth });
        const parentFolderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();

        const response = await drive.files.create({
            requestBody: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentFolderId],
            },
            fields: 'id, name, webViewLink',
        });

        const { id, name, webViewLink } = response.data;
        console.log(`[GOOGLE DRIVE] ✅ Pasta criada: "${name}" | ID: ${id}`);
        return { id, webViewLink };

    } catch (err) {
        // Erros de credencial, rede ou permissão são logados mas não interrompem o fluxo
        console.error('[GOOGLE DRIVE] ❌ Erro ao criar pasta:', err.message);
        return null;
    }
}

module.exports = { createProposalFolder, isDriveConfigured };
