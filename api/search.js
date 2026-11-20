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

module.exports = (req, res) => {
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
                error: 'يرجى إدخال كود الطالب أو الرقم القومي بشكل صحيح.'
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
                error: 'لم يتم العثور على أي حساب مسجل بهذا الرقم. يرجى التأكد من الكود والمحاولة مرة أخرى.'
            });
        }

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
