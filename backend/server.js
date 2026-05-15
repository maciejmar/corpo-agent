require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/tasks',    require('./src/routes/tasks.routes'));
app.use('/api/finances', require('./src/routes/finances.routes'));
app.use('/api/voice',    require('./src/routes/voice.routes'));
app.use('/api/costs',    require('./src/routes/costs.routes'));
app.use('/api/kpi',      require('./src/routes/kpi.routes'));

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;

async function start() {
  // Run migrations on startup
  try {
    const fs = require('fs');
    const path = require('path');
    const { query } = require('./src/db/database');
    const schema = fs.readFileSync(path.join(__dirname, 'src/db/schema.sql'), 'utf8');
    await query(schema);
    console.log('DB schema applied.');
  } catch (err) {
    console.error('Migration error:', err.message);
  }

  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}

start();
