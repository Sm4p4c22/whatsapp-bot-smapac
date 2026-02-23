// index.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// ============================================
// CONFIGURACIÓN DEL BOT DE WHATSAPP
// ============================================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium-browser', // Ruta CORREGIDA con guión
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote'
        ]
    }
});

// Mostrar QR para escanear con el celular
client.on('qr', (qr) => {
    console.log('📱 Escanea este código QR con WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// Cuando el bot está listo
client.on('ready', () => {
    console.log('✅ Bot conectado y listo para usar!');
});

// ============================================
// GESTIÓN DE ESTADOS DE CONVERSACIÓN
// ============================================
// Aquí guardamos en qué paso está cada usuario
const conversaciones = new Map(); // { numero: { estado: 'inicio', contrato: null } }

client.on('message', async (message) => {
    const numero = message.from; // Ej: "521234567890@c.us"
    const texto = message.body.trim();
    
    console.log(`📩 Mensaje de ${numero}: ${texto}`);
    
    // Obtener o crear estado del usuario
    if (!conversaciones.has(numero)) {
        conversaciones.set(numero, { estado: 'inicio' });
    }
    
    const estadoActual = conversaciones.get(numero);
    
    try {
        // ============================================
        // MÁQUINA DE ESTADOS - FLUJO DE CONVERSACIÓN
        // ============================================
        
        // ESTADO 1: SALUDO INICIAL
        if (estadoActual.estado === 'inicio') {
            await message.reply(
                '¡Hola! ¿Quieres consultar el estatus y adeudo de un contrato?\n' +
                'Responde *SÍ* o *NO*'
            );
            conversaciones.set(numero, { estado: 'esperando_confirmacion' });
        }
        
        // ESTADO 2: ESPERANDO CONFIRMACIÓN
        else if (estadoActual.estado === 'esperando_confirmacion') {
            if (texto.toLowerCase() === 'sí' || texto.toLowerCase() === 'si') {
                await message.reply('Por favor, envíame tu *número de contrato*:');
                conversaciones.set(numero, { estado: 'esperando_contrato' });
            } else {
                await message.reply('Ok, gracias por contactarnos. ¡Hasta luego!');
                conversaciones.set(numero, { estado: 'inicio' }); // Reiniciamos
            }
        }
        
        // ESTADO 3: ESPERANDO NÚMERO DE CONTRATO
        else if (estadoActual.estado === 'esperando_contrato') {
            const numeroContrato = texto;
            
            // Mostrar que estamos procesando
            await message.reply('🔍 Consultando información, un momento por favor...');
            
            // Llamar a tu API existente
            const resultado = await consultarAPI(numeroContrato);
            
            // Enviar respuesta al usuario
            await message.reply(resultado);
            
            // Reiniciamos la conversación para que pueda consultar otro contrato
            conversaciones.set(numero, { estado: 'inicio' });
        }
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        await message.reply('❌ Ocurrió un error. Por favor, intenta más tarde.');
        conversaciones.set(numero, { estado: 'inicio' }); // Reiniciamos por seguridad
    }
});

// ============================================
// FUNCIÓN PARA CONSULTAR TU API EXISTENTE
// ============================================
async function consultarAPI(numeroContrato) {
    try {
        // Validar que el contrato sea de 6 dígitos
        if (!/^\d{6}$/.test(numeroContrato)) {
            return '❌ El número de contrato debe tener *6 dígitos*. Por favor verifica.';
        }
        
        // Construir la URL correcta
        const url = `${process.env.API_CONTRATOS_URL}contratos/${numeroContrato}`;
        console.log('Consultando:', url); // Para depurar
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        // Verificar que la respuesta es válida
        if (response.data && response.data.nombre) {
            // Formatear la respuesta de manera amigable
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
// INICIAR EL BOT Y EL SERVIDOR
// ============================================
client.initialize();

// Pequeño servidor web (útil si después necesitas webhooks)
app.get('/', (req, res) => {
    res.send('🤖 Chatbot de WhatsApp funcionando!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor web corriendo en http://localhost:${PORT}`);
});