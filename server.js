const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(__dirname));

// --- Работа с файлом данных ---
function readData() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return { transactions: [], startAmount: 0 };
    }
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// --- API ---

// Получить все данные
app.get('/api/data', (req, res) => {
    res.json(readData());
});

// Добавить транзакцию
app.post('/api/transaction', (req, res) => {
    const data = readData();
    const t = req.body;
    t.id = Date.now();
    data.transactions.push(t);
    writeData(data);
    res.json({ ok: true, id: t.id });
});

// Удалить транзакцию
app.delete('/api/transaction/:id', (req, res) => {
    const data = readData();
    const id = Number(req.params.id);
    data.transactions = data.transactions.filter(t => t.id !== id);
    writeData(data);
    res.json({ ok: true });
});

// Задать начальную сумму
app.put('/api/start-amount', (req, res) => {
    const data = readData();
    data.startAmount = req.body.amount || 0;
    writeData(data);
    res.json({ ok: true });
});

// --- Запуск ---
app.listen(PORT, () => {
    console.log('Траты: http://localhost:' + PORT);
});