// ============================================
// DIAGNÓSTICO: Buscar Chromium
// ============================================
const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔍 Iniciando diagnóstico de Chromium...');

// Buscar en rutas comunes
const rutasPosibles = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser-stable',
    '/snap/bin/chromium',
    '/app/.apt/usr/bin/chromium',
    '/app/.apt/usr/bin/chromium-browser'
];

console.log('🔍 Buscando en rutas específicas:');
rutasPosibles.forEach(ruta => {
    try {
        if (fs.existsSync(ruta)) {
            console.log(`✅ ENCONTRADO: ${ruta}`);
        } else {
            console.log(`❌ No encontrado: ${ruta}`);
        }
    } catch (e) {
        console.log(`Error al verificar ${ruta}`);
    }
});

// Buscar con el comando 'which'
console.log('\n🔍 Buscando con comandos del sistema:');
try {
    const result = execSync('which chromium').toString().trim();
    console.log(`✅ 'which chromium' → ${result}`);
} catch (e) {
    console.log('❌ chromium no está en PATH');
}

try {
    const result = execSync('which chromium-browser').toString().trim();
    console.log(`✅ 'which chromium-browser' → ${result}`);
} catch (e) {
    console.log('❌ chromium-browser no está en PATH');
}

try {
    const result = execSync('which google-chrome').toString().trim();
    console.log(`✅ 'which google-chrome' → ${result}`);
} catch (e) {
    console.log('❌ google-chrome no está en PATH');
}

// Buscar en directorios comunes
console.log('\n🔍 Buscando en /usr/bin/...');
try {
    const files = execSync('ls -la /usr/bin/ | grep -E "chrom|chrome" | head -20').toString();
    console.log('Archivos encontrados en /usr/bin/:');
    console.log(files);
} catch (e) {
    console.log('❌ Error al listar /usr/bin/');
}

console.log('🔍 Diagnóstico completado\n');
console.log('=' .repeat(50) + '\n');

// ============================================
// CONFIGURACIÓN DEL BOT DE WHATSAPP
// ============================================
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// ============================================
// INICIALIZACIÓN ASÍNCRONA DEL BOT
// ============================================
async function iniciarBot() {
    try {
        console.log('🚀 Iniciando bot...');
        
        // Determinar la ruta de Chrome/Chromium
        let executablePath = '/usr/bin/google-chrome-stable'; // Por defecto
        
        // Verificar si existe alguna de las rutas posibles
        if (fs.existsSync('/usr/bin/google-chrome-stable')) {
            executablePath = '/usr/bin/google-chrome-stable';
        } else if (fs.existsSync('/usr/bin/chromium-browser')) {
            executablePath = '/usr/bin/chromium-browser';
        } else if (fs.existsSync('/usr/bin/chromium')) {
            executablePath = '/usr/bin/chromium';
        }
        
        console.log(`🔧 Usando navegador en: ${executablePath}`);

        const client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                executablePath: executablePath,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-extensions'
                ]
            }
        });

        // Mostrar QR para escanear con el celular
        client.on('qr', (qr) => {
            console.log('📱 Escanea este código QR con WhatsApp:');
            qrcode.generate(qr, { small: true });
            
            // Guardar QR para acceso web
            try {
                fs.writeFileSync('./qr.txt', qr);
            } catch (e) {
                console.error('Error guardando QR:', e.message);
            }
        });

        // Cuando el bot está listo
        client.on('ready', () => {
            console.log('✅ Bot conectado y listo para usar!');
        });

        client.on('disconnected', (reason) => {
            console.log('❌ Bot desconectado:', reason);
            setTimeout(() => {
                console.log('🔄 Reconectando...');
                iniciarBot();
            }, 5000);
        });

        // ============================================
        // GESTIÓN DE ESTADOS DE CONVERSACIÓN
        // ============================================
        const conversaciones = new Map();

        client.on('message', async (message) => {
            const numero = message.from;
            const texto = message.body.trim();
            
            console.log(`📩 Mensaje de ${numero}: ${texto}`);
            
            if (!conversaciones.has(numero)) {
                conversaciones.set(numero, { estado: 'inicio' });
            }
            
            const estadoActual = conversaciones.get(numero);
            
            try {
                if (estadoActual.estado === 'inicio') {
                    await message.reply(
                        '¡Hola! ¿Quieres consultar el estatus y adeudo de un contrato?\n' +
                        'Responde *SÍ* o *NO*'
                    );
                    conversaciones.set(numero, { estado: 'esperando_confirmacion' });
                }
                else if (estadoActual.estado === 'esperando_confirmacion') {
                    if (texto.toLowerCase() === 'sí' || texto.toLowerCase() === 'si') {
                        await message.reply('Por favor, envíame tu *número de contrato*:');
                        conversaciones.set(numero, { estado: 'esperando_contrato' });
                    } else {
                        await message.reply('Ok, gracias por contactarnos. ¡Hasta luego!');
                        conversaciones.set(numero, { estado: 'inicio' });
                    }
                }
                else if (estadoActual.estado === 'esperando_contrato') {
                    const numeroContrato = texto;
                    await message.reply('🔍 Consultando información, un momento por favor...');
                    const resultado = await consultarAPI(numeroContrato);
                    await message.reply(resultado);
                    conversaciones.set(numero, { estado: 'inicio' });
                }
            } catch (error) {
                console.error('Error procesando mensaje:', error);
                await message.reply('❌ Ocurrió un error. Por favor, intenta más tarde.');
                conversaciones.set(numero, { estado: 'inicio' });
            }
        });

        await client.initialize();
        return client;

    } catch (error) {
        console.error('❌ Error iniciando bot:', error.message);
        setTimeout(() => {
            console.log('🔄 Reintentando en 10 segundos...');
            iniciarBot();
        }, 10000);
    }
}

// ============================================
// FUNCIÓN PARA CONSULTAR API
// ============================================
async function consultarAPI(numeroContrato) {
    try {
        if (!/^\d{6}$/.test(numeroContrato)) {
            return '❌ El número de contrato debe tener *6 dígitos*. Por favor verifica.';
        }
        
        const url = `${process.env.API_CONTRATOS_URL}contratos/${numeroContrato}`;
        console.log('Consultando:', url);
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.data && response.data.nombre) {
            let mensaje = `✅ *CONTRATO ENCONTRADO*\n\n`;
            mensaje += `👤 *Nombre:* ${response.data.nombre}\n`;
            mensaje += `📍 *Dirección:* ${response.data.direccion}, Col. ${response.data.colonia}\n`;
            mensaje += `📮 *CP:* ${response.data.cp}\n`;
            mensaje += `🏠 *Giro:* ${response.data.giro}\n\n`;
            mensaje += `💰 *Adeudo actual:* $${response.data.adeuda.toFixed(2)} MXN\n`;
            
            if (response.data.multas > 0) {
                mensaje += `⚠️ *Multas:* $${response.data.multas.toFixed(2)} MXN\n`;
            }
            
            mensaje += `📊 *Estatus:* ${response.data.estatus}\n`;
            mensaje += `📅 *Mes facturado:* ${response.data.mes_facturado}\n`;
            mensaje += `⏰ *Fecha de vencimiento:* ${response.data.fecha_vencimiento}\n`;
            
            if (response.data.adeuda_padron > 0) {
                mensaje += `\n💡 *Total con padron:* $${response.data.adeuda_padron.toFixed(2)} MXN`;
            }
            
            return mensaje;
        } else {
            return '❌ No se encontró información para ese contrato.';
        }
    } catch (error) {
        console.error('Error detallado:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
            return '❌ Contrato no encontrado. Verifica que el número sea correcto.';
        } else if (error.code === 'ECONNABORTED') {
            return '⏰ Tiempo de espera agotado. Intenta más tarde.';
        } else {
            return '❌ Error al consultar el contrato. Por favor intenta de nuevo.';
        }
    }
}

// ============================================
// INICIAR EL BOT
// ============================================
iniciarBot();

// ============================================
// SERVIDOR WEB
// ============================================
app.get('/', (req, res) => {
    res.send('🤖 Chatbot de WhatsApp funcionando!');
});

app.get('/qr', (req, res) => {
    try {
        const qr = fs.readFileSync('./qr.txt', 'utf8');
        res.send(`
            <html>
                <head><title>QR del Bot</title></head>
                <body>
                    <h1>📱 Código QR</h1>
                    <pre>${qr}</pre>
                    <p>Escanea con WhatsApp</p>
                </body>
            </html>
        `);
    } catch (e) {
        res.send('No hay QR disponible aún');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor web corriendo en http://localhost:${PORT}`);
});