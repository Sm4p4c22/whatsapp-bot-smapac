// ============================================
// DIAGNÓSTICO SOLO PARA LINUX (comentado en Windows)
// ============================================
const fs = require('fs');
const { execSync } = require('child_process');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// Solo ejecutar diagnóstico completo en Linux
if (process.platform !== 'win32') {
    console.log('🔍 Iniciando diagnóstico de Chromium...');
    
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

    console.log('\n🔍 Diagnóstico completado\n');
    console.log('=' .repeat(50) + '\n');
}

// ============================================
// INICIALIZACIÓN ASÍNCRONA DEL BOT (MULTIPLATAFORMA)
// ============================================
async function iniciarBot() {
    try {
        console.log('🚀 Iniciando bot...');
        
        let executablePath;
        const platform = process.platform;
        console.log(`🖥️  Sistema operativo detectado: ${platform}`);
        
        if (platform === 'win32') {
            // ============================================
            // Estamos en WINDOWS
            // ============================================
            console.log('🔍 Buscando Chrome en Windows...');
            const rutasWindows = [
                'C:\\Program Files\\Chromium\\Application\\chrome.exe', // ✅ NUEVA RUTA
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Users\\TI MASTER\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
                'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
                'C:\\Users\\TI MASTER\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
            ];
            
            for (const ruta of rutasWindows) {
                try {
                    if (fs.existsSync(ruta)) {
                        executablePath = ruta;
                        console.log(`✅ Navegador encontrado en: ${ruta}`);
                        break;
                    }
                } catch (e) {
                    // Ignorar errores de permisos
                }
            }
        } else {
            // ============================================
            // Estamos en LINUX (Render, Heroku, etc.)
            // ============================================
            console.log('🔍 Buscando Chromium en Linux...');
            const rutasLinux = [
                '/usr/bin/chromium',
                '/usr/bin/chromium-browser',
                '/usr/bin/google-chrome-stable',
                '/app/.apt/usr/bin/chromium',
                '/app/.apt/usr/bin/chromium-browser'
            ];
            
            for (const ruta of rutasLinux) {
                try {
                    if (fs.existsSync(ruta)) {
                        executablePath = ruta;
                        console.log(`✅ Chromium encontrado en: ${ruta}`);
                        break;
                    }
                } catch (e) {
                    // Ignorar errores de permisos
                }
            }
        }
        
        if (!executablePath) {
            console.log('❌ No se encontró ningún navegador');
            if (platform === 'win32') {
                console.log('💡 En Windows, instala Chrome desde: https://www.google.com/chrome/');
            } else {
                console.log('💡 En Linux, asegúrate de instalar chromium con: apt-get install chromium');
            }
            // En Windows, podemos intentar con la ruta por defecto de Chrome
            if (platform === 'win32') {
                executablePath = 'C:\\Program Files\\Chromium\\Application\\chrome.exe';
                console.log('🔧 Intentando con ruta por defecto de Chrome...');
            } else {
                return; // En Linux sí detenemos si no hay navegador
            }
        }
        
        console.log(`🔧 Usando navegador en: ${executablePath}`);

        const client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: false, // Cambiado a false para ver qué pasa
                executablePath: executablePath,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-extensions',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--allow-running-insecure-content',
                    '--window-size=1280,800',
                    '--remote-debugging-port=9222',
                    '--disable-blink-features=AutomationControlled', // Importante
                    '--disable-sync', // Evita sincronización
                    '--disable-default-apps', // Evita apps de Chrome
                    '--disable-notifications' // Evita notificaciones
            ],
            defaultViewport: null, // Línea NUEVA importante
            ignoreDefaultArgs: ['--enable-automation'], // Oculta que es automatizado
            timeout: 60000 // Aumenta timeout a 60 segundos
    }
});

        // Mostrar QR para escanear con el celular
        client.on('qr', (qr) => {
            console.log('📱 Escanea este código QR con WhatsApp:');
            qrcode.generate(qr, { small: true });
            
            // Guardar QR para acceso web
            try {
                fs.writeFileSync('./qr.txt', qr);
                console.log('✅ QR guardado en archivo');
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

    } catch (error) {
        console.error('❌ Error en iniciarBot:', error.message);
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

// ============================================
// ENDPOINT PARA VER EL QR
// ============================================
app.get('/qr', (req, res) => {
    try {
        const qrCode = fs.readFileSync('./qr.txt', 'utf8');
        res.send(`
            <html>
                <head>
                    <title>WhatsApp Bot - QR</title>
                    <style>
                        body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
                        .container { background: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto; }
                        h1 { color: #333; }
                        .qr-container { margin: 30px auto; padding: 20px; background: #f9f9f9; border: 2px solid #ccc; }
                        pre { background: #f4f4f4; padding: 10px; overflow-x: auto; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>📱 Código QR</h1>
                        <div class="qr-container">
                            <p>Escanea este código con WhatsApp:</p>
                            <pre>${qrCode}</pre>
                        </div>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        res.send(`
            <html>
                <head><title>QR no disponible</title></head>
                <body>
                    <h1>⏳ QR no disponible aún</h1>
                    <p>El QR aparecerá cuando el bot inicie completamente.</p>
                    <meta http-equiv="refresh" content="10">
                </body>
            </html>
        `);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor web corriendo en http://localhost:${PORT}`);
});