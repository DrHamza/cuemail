// Vercel Serverless Function: /api/search
const path = require('path');
const fs = require('fs');

// Load private student data
let students = null;
let nidIndex = null;

function loadData() {
    if (!students) {
        try {
            // First try direct require (works in Vercel bundler)
            students = require('./_students.json');
        } catch (e) {
            // Fallback to fs read
            const filePath = path.join(__dirname, '_students.json');
            const raw = fs.readFileSync(filePath, 'utf8');
            students = JSON.parse(raw);
        }

        // Build lazy National ID index for instant lookup
        nidIndex = new Map();
        for (const [code, info] of Object.entries(students)) {
            if (info.nid && info.nid.length >= 10) {
                nidIndex.set(info.nid.trim(), code);
            }
        }
    }
}

// Convert Eastern Arabic numerals to standard 0-9
function normalizeInput(str) {
    if (!str) return '';
    const easternDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(str).replace(/[٠-٩]/g, d => easternDigits.indexOf(d)).trim();
}

// Send report of student inquiry to configured webhook / notifications
async function sendReport(logData) {
    // 1. Structured log for Vercel Logs Dashboard
    console.log('[REPORT:STUDENT_INQUIRY]', JSON.stringify(logData));

    // 2. Google Sheets or Custom Webhook URL (configured via REPORT_WEBHOOK_URL)
    const webhookUrl = process.env.REPORT_WEBHOOK_URL;
    if (webhookUrl) {
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logData)
            });
        } catch (e) {
            console.error('Webhook reporting error:', e.message);
        }
    }

    // 3. Telegram alert support (configured via TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChatId) {
        try {
            const message = `🎓 *استعلام جديد عن البريد الجامعي*\n` +
                            `━━━━━━━━━━━━━━━━━━\n` +
                            `👤 *الطالب:* ${logData.name}\n` +
                            `🔢 *الكود:* \`${logData.code}\`\n` +
                            `📧 *البريد:* \`${logData.email}\`\n` +
                            `🕒 *التاريخ والوقت:* ${logData.timestamp}\n` +
                            `🌐 *IP:* \`${logData.ip}\``;

            await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: tgChatId,
                    text: message,
                    parse_mode: 'Markdown'
                })
            });
        } catch (e) {
            console.error('Telegram reporting error:', e.message);
        }
    }
}

module.exports = async (req, res) => {
    // Security & Cache Headers: Never cache credential lookups
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        loadData();

        // Extract code from POST body or GET query
        let queryVal = '';
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            queryVal = body.code || body.nid || '';
        } else {
            queryVal = req.query.code || req.query.nid || '';
        }

        const normalizedCode = normalizeInput(queryVal);

        if (!normalizedCode || normalizedCode.length < 4) {
            return res.status(400).json({
                success: false,
                error: 'يرجى إدخال كود الطالب بشكل صحيح.'
            });
        }

        // 1. Check direct match by Student Code
        let student = students[normalizedCode];
        let foundCode = normalizedCode;

        // 2. If not found by Code, check if user provided National ID
        if (!student && nidIndex.has(normalizedCode)) {
            foundCode = nidIndex.get(normalizedCode);
            student = students[foundCode];
        }

        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'لم يتم العثور على أي حساب مسجل بهذا الكود. يرجى التأكد من صحة الكود والمحاولة مرة أخرى.'
            });
        }

        // Get Client IP and Cairo Time
        const rawIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'unknown';
        const clientIp = String(rawIp).split(',')[0].trim();
        const cairoTime = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });

        // Record & Dispatch Report
        const reportData = {
            code: foundCode,
            name: student.name || 'غير محدد',
            email: student.email || 'غير مسجل',
            faculty: student.faculty || 'كلية الدراسات العليا للتربية',
            timestamp: cairoTime,
            ip: clientIp,
            userAgent: req.headers['user-agent'] || 'unknown'
        };

        // Fire report in background
        sendReport(reportData).catch(e => console.error('Reporting error:', e));

        // Return ONLY the matched student's data
        return res.status(200).json({
            success: true,
            student: {
                code: foundCode,
                name: student.name || 'غير محدد',
                email: student.email || 'غير مسجل',
                pass: student.pass || '',
                stage: student.stage || 'دراسات عليا',
                faculty: student.faculty || 'كلية الدراسات العليا للتربية'
            }
        });
    } catch (err) {
        console.error('Search error:', err);
        return res.status(500).json({
            success: false,
            error: 'حدث خطأ في الخادم، يرجى المحاولة لاحقاً.'
        });
    }
};
